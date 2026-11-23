/**
 * globalSetup do Playwright: confere que tudo aponta para o ambiente de teste e zera o banco de teste
 * (migrações + seed + histórico, ~1 min) para cada rodada partir do mesmo estado.
 * E2E_SEM_ZERAR=1 pula o zerar (útil para repetir um spec que não depende de banco limpo).
 */
import { execSync } from "node:child_process";

import { conferirAmbiente } from "./ambiente";

export default async function preparo() {
  conferirAmbiente();
  if (process.env.E2E_SEM_ZERAR === "1") {
    console.log("E2E_SEM_ZERAR=1: banco de teste usado como está.");
    return;
  }
  execSync("npx tsx scripts/ambiente-teste.ts zerar", { stdio: "inherit" });
}
