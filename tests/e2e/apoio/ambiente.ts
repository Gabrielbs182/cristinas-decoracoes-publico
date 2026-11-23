/**
 * Onde os testes de navegador rodam: SÓ no ambiente de teste (app 3300 em modo produção → Supabase 573xx).
 * O banco de uso (55322) e o servidor de avaliação (3200) têm dados reais desde 24/10/2026: tudo aqui recusa
 * qualquer outro endereço, de propósito sem variável para trocar o app.
 */
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

export const BASE = "http://127.0.0.1:3300";
export const DB_URL = "postgresql://postgres:postgres@127.0.0.1:57322/postgres";
export const ENV_TESTE = ".ambiente-teste/.env.teste";
/** Caixa de e-mail do Supabase de teste (Mailpit): todo e-mail que o Auth manda cai aqui. */
export const MAILPIT = "http://127.0.0.1:57324";

/** Recusa rodar se o app de teste não estiver configurado para o Supabase de teste. */
export function conferirAmbiente() {
  if (!existsSync(ENV_TESTE)) throw new Error(`Falta ${ENV_TESTE}. Rode: npx tsx scripts/ambiente-teste.ts preparar`);
  const env = readFileSync(ENV_TESTE, "utf-8");
  if (!env.includes("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:57321") || !env.includes(`APP_URL=${BASE}`)) {
    throw new Error(`${ENV_TESTE} não aponta para o ambiente de teste (57321 / 3300). Recusado.`);
  }
}

export async function conectarBanco(): Promise<Client> {
  const db = new Client({ connectionString: DB_URL });
  try {
    await db.connect();
  } catch (e) {
    throw new Error(`Banco de teste indisponível em ${DB_URL}. Rode "npx tsx scripts/ambiente-teste.ts preparar". (${(e as Error).message})`);
  }
  return db;
}

/** Cliente com a chave secreta do Supabase de TESTE, para montar cenário que só a API de admin cria (login com e-mail). */
export function adminDoTeste() {
  conferirAmbiente();
  const env = Object.fromEntries(
    readFileSync(ENV_TESTE, "utf-8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}
