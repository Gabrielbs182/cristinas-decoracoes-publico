/**
 * App de TESTE: build de produção e o mesmo servidor que vai para a VPS (.next/standalone/server.js) na porta
 * 3300, com as variáveis do ambiente de teste (.ambiente-teste/.env.teste → Supabase 573xx). Assim a regressão e
 * o smoke conferem o artefato de produção, não o `next start`. Usado pelo playwright.config (webServer).
 * Nunca aponta para o banco de uso: recusa se o .env.teste não for o do Supabase de teste.
 *
 *   node scripts/servidor-teste.mjs            # build + sobe
 *   node scripts/servidor-teste.mjs --sem-build
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ARQUIVO = ".ambiente-teste/.env.teste";
if (!existsSync(ARQUIVO)) {
  console.error(`Falta ${ARQUIVO}. Rode: npx tsx scripts/ambiente-teste.ts preparar`);
  process.exit(1);
}
const env = { ...process.env };
for (const linha of readFileSync(ARQUIVO, "utf-8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(":57321") || env.APP_URL !== "http://127.0.0.1:3300") {
  console.error("O .env.teste não aponta para o ambiente de teste (57321 / 3300). Recusado.");
  process.exit(1);
}

const STANDALONE = path.join(".next", "standalone");
if (!process.argv.includes("--sem-build")) {
  const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
  // O servidor enxuto não leva public/ nem os arquivos estáticos: copiar, como o Dockerfile faz.
  cpSync("public", path.join(STANDALONE, "public"), { recursive: true });
  cpSync(path.join(".next", "static"), path.join(STANDALONE, ".next", "static"), { recursive: true });
}
const servidor = spawnSync(process.execPath, ["server.js"], { cwd: STANDALONE, env: { ...env, PORT: "3300", HOSTNAME: "127.0.0.1" }, stdio: "inherit" });
process.exit(servidor.status ?? 0);
