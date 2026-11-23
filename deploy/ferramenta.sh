#!/usr/bin/env bash
# Roda um script do projeto (scripts/*.ts) contra o Supabase da VPS: lê deploy/.env e fala com o Supabase pelo
# endereço local da própria VPS (127.0.0.1:8000, que não sai para a internet). Precisa de `npm ci` feito uma vez.
#
#   deploy/ferramenta.sh scripts/producao.ts gestora --login=cristina --nome="Cristina"
#   deploy/ferramenta.sh scripts/importar-historico.ts --gravar --gestora=cristina
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
. deploy/.env
set +a
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:${PORTA_API:-8000}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_ANON_KEY"
export SUPABASE_SECRET_KEY="$SUPABASE_SERVICE_ROLE_KEY"
exec npx tsx "$@"
