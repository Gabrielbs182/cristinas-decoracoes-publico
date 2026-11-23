#!/usr/bin/env bash
# Ensaio da cópia de segurança no AMBIENTE DE TESTE (573xx), de ponta a ponta: copia (deploy/backup/backup.sh),
# provoca o "desastre" (banco zerado só com as migrações, arquivos do Storage apagados), restaura
# (deploy/backup/restaurar.sh) e confere a contagem de cada tabela. Nunca toca no banco de uso.
#
#   bash scripts/ensaiar-restauracao.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1 # Git Bash no Windows: não converter /mnt dos comandos do docker
export DB_CONTAINER=supabase_db_cristinas-teste STORAGE_CONTAINER=supabase_storage_cristinas-teste STORAGE_PATH=/mnt
export BACKUP_DIR="$PWD/test-results/ensaio-copias"
rm -rf "$BACKUP_DIR"

deploy/backup/backup.sh
PASTA=$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d | sort | tail -1)

echo "== desastre: banco zerado e arquivos apagados"
npx supabase db reset --workdir .ambiente-teste >/dev/null 2>&1
docker exec "$STORAGE_CONTAINER" sh -c 'find /mnt -mindepth 1 -delete'

echo "== restauração"
CONFIRMO=apagar-e-restaurar deploy/backup/restaurar.sh "$PASTA"

# Contagem igual não basta: o arquivo precisa abrir. Regressão (24/10/2026): sem os atributos estendidos (xattr) o
# Storage devolvia 500 em todo download restaurado. Baixa um espelho pela API do Storage com a chave secreta.
. .ambiente-teste/.env.teste
OBJETO=$(docker exec "$DB_CONTAINER" psql -U postgres -At -c "select bucket_id || '/' || name from storage.objects order by created_at desc limit 1")
if [ -n "$OBJETO" ]; then
  BAIXADO="test-results/ensaio-copias/baixado.pdf" # relativo: o curl do Windows não entende /c/...
  STATUS=$(curl -s -o "$BAIXADO" -w "%{http_code}" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/$OBJETO") || true
  [ "$STATUS" = 200 ] && head -c 4 "$BAIXADO" | grep -q "%PDF" || { echo "ERRO: o arquivo restaurado $OBJETO não abre (HTTP $STATUS)."; exit 1; }
  echo "Arquivo restaurado abre: $OBJETO"
fi
