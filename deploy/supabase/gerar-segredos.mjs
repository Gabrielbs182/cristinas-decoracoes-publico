/**
 * Gera docker/.env (Supabase) e ../.env (app) com segredos novos, a partir do docker/.env.example oficial.
 * Roda uma vez, na VPS, pelo preparar.sh. Não sobrescreve nada que já exista.
 *
 *   APP_URL=https://sistema.exemplo.com.br node gerar-segredos.mjs
 */
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const APP_URL = process.env.APP_URL?.replace(/\/$/, "");
if (!APP_URL?.startsWith("https://")) throw new Error("APP_URL precisa ser o endereço https do sistema.");
for (const f of ["docker/.env", "../.env"]) if (existsSync(f)) throw new Error(`${f} já existe: não troco segredos de um sistema no ar.`);

const hex = (n) => randomBytes(n).toString("hex");
const b64 = (n) => randomBytes(n).toString("base64");
const b64url = (s) => Buffer.from(s).toString("base64url");
const JWT_SECRET = randomBytes(48).toString("base64url");
const jwt = (role) => {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify({ role, iss: "supabase", iat: agora, exp: agora + 20 * 365 * 24 * 3600 }))}`;
  return `${corpo}.${createHmac("sha256", JWT_SECRET).update(corpo).digest("base64url")}`;
};

const valores = {
  COMPOSE_FILE: "docker-compose.yml:docker-compose.cristinas.yml",
  POSTGRES_PASSWORD: hex(24),
  JWT_SECRET,
  ANON_KEY: jwt("anon"),
  SERVICE_ROLE_KEY: jwt("service_role"),
  DASHBOARD_USERNAME: "cristinas",
  DASHBOARD_PASSWORD: hex(16),
  SECRET_KEY_BASE: b64(48),
  REALTIME_DB_ENC_KEY: hex(8),
  VAULT_ENC_KEY: hex(16),
  PG_META_CRYPTO_KEY: b64(24),
  LOGFLARE_PUBLIC_ACCESS_TOKEN: b64(24),
  LOGFLARE_PRIVATE_ACCESS_TOKEN: b64(24),
  POOLER_TENANT_ID: "cristinas",
  // Studio e API só pela própria VPS (túnel SSH); os links de e-mail apontam para o app (APP_URL).
  SUPABASE_PUBLIC_URL: "http://127.0.0.1:8000",
  API_EXTERNAL_URL: "http://127.0.0.1:8000/auth/v1",
  SITE_URL: APP_URL,
  ADDITIONAL_REDIRECT_URLS: `${APP_URL}/**`,
  JWT_EXPIRY: "3600",
  // Sem cadastro público, mas com login por e-mail LIGADO: ENABLE_EMAIL_SIGNUP liga o provedor de e-mail
  // (a mesma armadilha do config.toml: desligá-lo desliga o login).
  DISABLE_SIGNUP: "true",
  ENABLE_EMAIL_SIGNUP: "true",
  ENABLE_EMAIL_AUTOCONFIRM: "false",
  ENABLE_ANONYMOUS_USERS: "false",
  ENABLE_PHONE_SIGNUP: "false",
  ENABLE_PHONE_AUTOCONFIRM: "false",
};

let env = readFileSync("docker/.env.example", "utf-8");
for (const [chave, valor] of Object.entries(valores)) {
  const linha = `${chave}=${valor}`;
  env = new RegExp(`^${chave}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${chave}=.*$`, "m"), linha) : `${env}\n${linha}`;
}
writeFileSync("docker/.env", env, { mode: 0o600 });

const app = [
  "# App (deploy/docker-compose.yml). Gerado pelo deploy/supabase/gerar-segredos.mjs; não vai para o git.",
  `APP_URL=${APP_URL}`,
  "# Versão da imagem do app (ghcr.io); troque pela tag (ex.: v0.12.0) para fixá-la.",
  "VERSAO=latest",
  `DOMINIO=${new URL(APP_URL).host}`,
  "SUPABASE_URL_INTERNA=http://kong:8000",
  `SUPABASE_ANON_KEY=${valores.ANON_KEY}`,
  `SUPABASE_SERVICE_ROLE_KEY=${valores.SERVICE_ROLE_KEY}`,
  "USUARIOS_DOMINIO_INTERNO=usuarios.cristinas.invalid",
  `POSTGRES_PASSWORD=${valores.POSTGRES_PASSWORD}`,
  "",
].join("\n");
writeFileSync("../.env", app, { mode: 0o600 });
console.log("Gerados deploy/supabase/docker/.env e deploy/.env. Guarde uma cópia deles fora da VPS (cofre de senhas).");
