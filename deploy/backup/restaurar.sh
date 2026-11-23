#!/usr/bin/env bash
# Restaura uma cópia do backup.sh num Supabase já com as MESMAS migrações (deploy/README.md, "Restaurar").
# APAGA os dados atuais do banco e os arquivos do Storage. Termina conferindo a contagem de cada tabela.
#
#   CONFIRMO=apagar-e-restaurar deploy/backup/restaurar.sh /var/backups/cristinas/2026-10-25_030000
set -euo pipefail
cd "$(dirname "$0")"
PASTA=${1:?informe a pasta da cópia}
DB=${DB_CONTAINER:-supabase-db}
STORAGE=${STORAGE_CONTAINER:-supabase-storage}
STORAGE_PATH=${STORAGE_PATH:-/var/lib/storage}
ARQUIVADOR=${ARQUIVADOR_IMAGE:-debian:bookworm-slim}
[ "${CONFIRMO:-}" = "apagar-e-restaurar" ] || { echo "Isto APAGA os dados atuais. Rode com CONFIRMO=apagar-e-restaurar."; exit 1; }
(cd "$PASTA" && sha256sum -c --quiet SHA256SUMS)
sql() { docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -At "$@"; }

atual=$(sql -c "select max(version) from supabase_migrations.schema_migrations")
[ "$atual" = "$(cat "$PASTA/migracao.txt")" ] || { echo "O banco está na migração $atual e a cópia na $(cat "$PASTA/migracao.txt"): aplique as mesmas migrações antes."; exit 1; }

# Esvazia o que as migrações e os serviços criaram (feriados, buckets…) para entrar exatamente o da cópia.
# session_replication_role = replica: as travas (batida imutável, diário append-only) não disparam na carga.
sql <<'SQL'
set session_replication_role = replica;
select format('truncate %s restart identity cascade', string_agg(format('%I.%I', n.nspname, c.relname), ', '))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r', 'p') and n.nspname in ('public', 'auth', 'storage')
   and (n.nspname, c.relname) not in (('auth', 'schema_migrations'), ('storage', 'migrations'))
\gexec
SQL
docker exec -i "$DB" pg_restore -U supabase_admin -d postgres --data-only --disable-triggers --single-transaction <"$PASTA/banco.dump"
# GNU tar com --xattrs: o Storage precisa dos atributos estendidos de cada arquivo (ver backup.sh).
docker run --rm -i --volumes-from "$STORAGE" "$ARQUIVADOR" sh -c "find '$STORAGE_PATH' -mindepth 1 -delete && tar --xattrs --xattrs-include='*' -C '$STORAGE_PATH' -xzf -" <"$PASTA/arquivos.tar.gz"

if diff <(sql <contagens.sql) "$PASTA/contagens.txt" >/dev/null; then
  echo "Restaurado: $(wc -l <"$PASTA/contagens.txt") tabelas com a mesma contagem da cópia."
else
  echo "ATENÇÃO: contagens diferentes da cópia:"; diff <(sql <contagens.sql) "$PASTA/contagens.txt" || true; exit 1
fi
