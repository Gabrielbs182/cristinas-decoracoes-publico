/**
 * Testes de navegador, SÓ no ambiente de teste (app 3300 em modo produção → Supabase 573xx; ver CLAUDE.md).
 *
 *   npm run e2e      # regressão: os fluxos de cada versão, ponta a ponta (tests/e2e/regressao)
 *   npm run smoke    # todas as telas × todos os papéis, procurando erro (tests/e2e/smoke)
 *
 * Cada rodada sobe o Supabase de teste se estiver parado, zera o banco de teste (~1 min) e faz o build de
 * produção (~1–2 min). E2E_SEM_ZERAR=1 mantém o banco; E2E_REUSAR=1 usa um app já aberto na 3300 (atenção:
 * ele pode estar com código velho). Relatório: playwright-report/ (HTML) e test-results/resultado.json.
 */
import { defineConfig } from "@playwright/test";

import { BASE } from "./tests/e2e/apoio/ambiente";

export default defineConfig({
  testDir: "tests/e2e",
  // Os specs mexem no mesmo banco de teste: um de cada vez, na ordem dos arquivos.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./tests/e2e/apoio/preparo.ts",
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["json", { outputFile: "test-results/resultado.json" }]],
  use: {
    baseURL: BASE,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "regressao", testDir: "tests/e2e/regressao" },
    { name: "smoke", testDir: "tests/e2e/smoke" },
  ],
  webServer: {
    command: "npx tsx scripts/ambiente-teste.ts preparar && node scripts/servidor-teste.mjs",
    url: `${BASE}/login`,
    reuseExistingServer: process.env.E2E_REUSAR === "1",
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
