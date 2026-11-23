/**
 * Versões mínimas por segurança. Regressão (auditoria de 24/10/2026): o Next 16.3.8 tinha DoS sem login pelas
 * Server Actions (GHSA-p3m5-59mp-jv5r, corrigido na 16.4.1) e o login, a criação de senha e a aprovação do
 * orçamento são actions públicas. Um downgrade ou um lockfile velho reprova aqui.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const versao = (pacote: string) => JSON.parse(readFileSync(`node_modules/${pacote}/package.json`, "utf-8")).version as string;
const peloMenos = (atual: string, minima: string) => {
  const [a, b] = [atual, minima].map((v) => v.split("-")[0]!.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (a![i] !== b![i]) return a![i]! > b![i]!;
  return true;
};

describe("versões mínimas por segurança", () => {
  it.each([["next", "16.4.1"]])("%s ≥ %s", (pacote, minima) => {
    expect(peloMenos(versao(pacote), minima), `${pacote} ${versao(pacote)}`).toBe(true);
  });
});
