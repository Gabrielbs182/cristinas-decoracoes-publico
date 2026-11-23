/**
 * Dados de referência (empresa, regra de ponto vigente, feriados nacionais) vêm das MIGRAÇÕES. Regressão
 * (24/10/2026): moravam no supabase/seed.sql, que só roda no `db reset` local — na VPS o banco subiria sem regra de
 * ponto e sem feriado, e o motor de horas não teria com o que calcular.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contar, usarBanco } from "./banco";

usarBanco();

describe("dados de referência", () => {
  it("o seed.sql não tem dado que a produção precise", () => {
    const seed = readFileSync("supabase/seed.sql", "utf-8").replace(/--.*$/gm, "");
    expect(seed).not.toMatch(/\binsert\b/i);
  });

  it("empresa, regra de ponto e feriados nacionais até 2030 existem", async () => {
    expect(await contar("empresa")).toBe(1);
    expect(await contar("regras_ponto", "vigente_desde = '2026-01-05'")).toBe(1);
    for (const ano of [2026, 2027, 2028, 2029, 2030]) {
      expect(await contar("feriados", `tipo = 'nacional' and extract(year from data) = ${ano}`), `feriados nacionais de ${ano}`).toBe(10);
    }
    expect(await contar("feriados", "data = '2028-04-14' and nome = 'Sexta-feira Santa'")).toBe(1);
  });
});
