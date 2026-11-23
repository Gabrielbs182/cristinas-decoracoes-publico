/**
 * Regressão (auditoria de 24/10/2026): a trava do seed de dev só conferia "127.0.0.1" na URL. Numa VPS o Supabase
 * também escuta no loopback, e o seed trocaria a senha de todas as contas de produção pela senha de dev publicada.
 * Roda o script de verdade; a trava sai antes de qualquer acesso à rede.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rodarSeed = (url: string, extra: Record<string, string> = {}) =>
  spawnSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/seed-dev.ts"], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: "x", NODE_ENV: "development", ...extra },
    encoding: "utf-8",
    timeout: 30_000,
  });

describe("trava do seed de desenvolvimento", () => {
  it.each([
    ["Supabase no loopback de uma VPS", "http://127.0.0.1:8000"],
    ["localhost em outra porta", "http://localhost:54321"],
    ["Supabase na nuvem", "https://abc.supabase.co"],
    ["URL vazia", ""],
  ])("recusa %s", (_, url) => {
    const r = rodarSeed(url);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Recusado/);
  });

  it("recusa em produção mesmo apontando para a porta local", () => {
    const r = rodarSeed("http://127.0.0.1:55321", { NODE_ENV: "production" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Recusado/);
  });
});
