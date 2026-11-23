#!/usr/bin/env bash
# Cópia de segurança: os dados do banco (public, auth e storage — inclui logins e o índice dos arquivos), os
# arquivos do Storage (espelhos em PDF, anexos) e a contagem de linhas por tabela, para conferir a restauração.
# Na VPS roda todo dia pelo cron (deploy/README.md). Guarda RETER_DIAS dias; com DESTINO_FORA (um remoto do
# rclone, ex.: "b2:cristinas-copias"), manda a cópia também para fora da VPS.
set -euo pipefail
cd "$(dirname "$0")"
DIR=${BACKUP_DIR:-/var/backups/cristinas}
DB=${DB_CONTAINER:-supabase-db}
STORAGE=${STORAGE_CONTAINER:-supabase-storage}
STORAGE_PATH=${STORAGE_PATH:-/var/lib/storage}
RETER_DIAS=${RETER_DIAS:-30}
ARQUIVADOR=${ARQUIVADOR_IMAGE:-debian:bookworm-slim}
PASTA="$DIR/$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$PASTA"

docker exec "$DB" pg_dump -U supabase_admin -d postgres --data-only -Fc \
  --schema=public --schema=auth --schema=storage \
  --exclude-table-data=auth.schema_migrations --exclude-table-data=storage.migrations >"$PASTA/banco.dump"
# O Storage guarda o tipo e o tamanho de cada arquivo em atributos estendidos (xattr): sem eles o arquivo volta, mas
# o download dá erro 500. O tar do container do Storage (busybox) não os copia; o GNU tar (imagem Debian) copia.
docker run --rm --volumes-from "$STORAGE" "$ARQUIVADOR" tar --xattrs --xattrs-include='*' -C "$STORAGE_PATH" -czf - . >"$PASTA/arquivos.tar.gz"
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -At <contagens.sql >"$PASTA/contagens.txt"
# A restauração precisa de um banco com as mesmas migrações (o dump é só de dados).
docker exec "$DB" psql -U supabase_admin -d postgres -At -c "select max(version) from supabase_migrations.schema_migrations" >"$PASTA/migracao.txt"
(cd "$PASTA" && sha256sum banco.dump arquivos.tar.gz contagens.txt migracao.txt >SHA256SUMS)

find "$DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETER_DIAS" -exec rm -rf {} +
if [ -n "${DESTINO_FORA:-}" ]; then rclone copy "$PASTA" "$DESTINO_FORA/$(basename "$PASTA")"; fi
echo "Cópia em $PASTA ($(du -sh "$PASTA" | cut -f1); $(wc -l <"$PASTA/contagens.txt") tabelas)."
