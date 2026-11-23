/**
 * Ambiente de TESTE isolado: um segundo Supabase local (portas 573xx, projeto "cristinas-teste") com as
 * mesmas migrações, para os testes de navegador criarem dados à vontade sem tocar no banco de uso (553xx),
 * que desde 24/10/2026 tem dados reais.
 *
 *   npx tsx scripts/ambiente-teste.ts gerar      # (re)gera .ambiente-teste/supabase a partir de supabase/
 *   npx tsx scripts/ambiente-teste.ts preparar   # gerar + subir (se parado) + migrações novas + .env.teste
 *   npx tsx scripts/ambiente-teste.ts zerar      # banco do zero: migrações, seed, histórico e PDFs antigos
 *   npx tsx scripts/ambiente-teste.ts parar
 *
 * O app de teste roda em modo produção na porta 3300 apontando para ele (scripts/servidor-teste.mjs).
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ORIGEM = "supabase";
const PASTA = ".ambiente-teste";
const DESTINO = path.join(PASTA, "supabase");
export const ENV_TESTE = path.join(PASTA, ".env.teste");
// 563xx é do Supabase de outro projeto do usuário (isa-worker); 573xx estava livre em 24/10/2026.
const DESLOCAMENTO = 2000;

const rodar = (comando: string, silencioso = false) => execSync(comando, { stdio: silencioso ? "pipe" : "inherit", encoding: "utf-8" });

function gerar() {
  if (existsSync(DESTINO)) rmSync(DESTINO, { recursive: true });
  mkdirSync(DESTINO, { recursive: true });
  cpSync(path.join(ORIGEM, "migrations"), path.join(DESTINO, "migrations"), { recursive: true });
  if (existsSync(path.join(ORIGEM, "seed.sql"))) cpSync(path.join(ORIGEM, "seed.sql"), path.join(DESTINO, "seed.sql"));
  cpSync(path.join(ORIGEM, "templates"), path.join(DESTINO, "templates"), { recursive: true });

  let config = readFileSync(path.join(ORIGEM, "config.toml"), "utf-8");
  config = config.replace(/^project_id = ".*"$/m, 'project_id = "cristinas-teste"');
  // Todas as portas do projeto (553xx) e a do inspetor do edge runtime andam +2000.
  config = config.replace(/^((?:port|shadow_port|inspector_port) = )(\d+)$/gm, (_, chave: string, porta: string) => `${chave}${Number(porta) + DESLOCAMENTO}`);
  config = config.replaceAll("127.0.0.1:3100", "127.0.0.1:3300");
  writeFileSync(path.join(DESTINO, "config.toml"), config);
  const portas = [...config.matchAll(/^(?:port|shadow_port|inspector_port) = (\d+)$/gm)].map((m) => m[1]);
  console.log(`Gerado ${DESTINO} (projeto cristinas-teste, portas ${portas.join(", ")}).`);
}

function escreverEnv() {
  const status = rodar(`npx supabase status -o env --workdir ${PASTA}`, true);
  const valor = (chave: string) => status.match(new RegExp(`^${chave}="?([^"\\r\\n]*)"?`, "m"))?.[1] ?? "";
  const env = [
    "# App de teste (modo produção, porta 3300) → Supabase de teste (573xx). Gerado; não vai para o git.",
    `NEXT_PUBLIC_SUPABASE_URL=${valor("API_URL")}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${valor("PUBLISHABLE_KEY")}`,
    `SUPABASE_SECRET_KEY=${valor("SECRET_KEY")}`,
    "USUARIOS_DOMINIO_INTERNO=usuarios.cristinas.invalid",
    "APP_URL=http://127.0.0.1:3300",
    "",
  ].join("\n");
  if (!valor("API_URL").includes(":57321")) throw new Error(`Status inesperado do Supabase de teste:\n${status}`);
  writeFileSync(ENV_TESTE, env);
  console.log(`Escrito ${ENV_TESTE}.`);
}

function preparar() {
  gerar();
  let rodando = false;
  try {
    rodando = rodar(`npx supabase status --workdir ${PASTA}`, true).includes("57321");
  } catch {
    rodando = false;
  }
  if (!rodando) rodar(`npx supabase start --workdir ${PASTA}`);
  rodar(`npx supabase migration up --workdir ${PASTA}`);
  escreverEnv();
}

/** Banco de teste do zero com o mesmo estado-base do banco de uso (sem os dados reais de depois). */
function zerar() {
  preparar();
  rodar(`npx supabase db reset --workdir ${PASTA}`);
  const env = `--env-file=${ENV_TESTE}`;
  // O seed às vezes cai na saída do processo (falha do Node no Windows): uma nova tentativa resolve.
  try {
    rodar(`npx tsx ${env} scripts/seed-dev.ts`);
  } catch {
    rodar(`npx tsx ${env} scripts/seed-dev.ts`);
  }
  // O histórico (34 semanas fechadas + espelhos antigos) depende de dados/ (fora do git): sem ele, o banco fica sem
  // semana fechada e os testes que precisam de uma avisam e pulam só aquela conferência.
  // E2E_SEM_HISTORICO=1 (com SEED_FUNCIONARIAS_CSV=scripts/dados-exemplo/funcionarias.csv) reproduz aqui a CI.
  if (!existsSync("dados/historico-legado.json") || process.env.E2E_SEM_HISTORICO === "1") {
    console.warn("Banco de teste sem o histórico do sistema antigo (sem dados/historico-legado.json ou E2E_SEM_HISTORICO=1).");
    return;
  }
  rodar(`npx tsx ${env} scripts/importar-historico.ts --gravar`);
  rodar(`npx tsx ${env} scripts/anexar-pdfs-legado.ts`);
}

const comando = process.argv[2] ?? "gerar";
const COMANDOS: Record<string, () => void> = { gerar, preparar, zerar, parar: () => rodar(`npx supabase stop --workdir ${PASTA}`) };
if (!COMANDOS[comando]) {
  console.error(`Comando desconhecido: ${comando}. Use: ${Object.keys(COMANDOS).join(", ")}.`);
  process.exit(1);
}
COMANDOS[comando]!();
