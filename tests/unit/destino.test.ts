import { describe, expect, it } from "vitest";

import { destinoSeguro } from "@/lib/destino";

describe("destinoSeguro (?volta= do login)", () => {
  it("aceita caminho deste site, com busca", () => {
    expect(destinoSeguro("/inicio")).toBe("/inicio");
    expect(destinoSeguro("/orcamentos?s=vencido")).toBe("/orcamentos?s=vencido");
    expect(destinoSeguro("/meu-ponto/corrigir?dia=2026-09-29&tipo=V")).toBe("/meu-ponto/corrigir?dia=2026-09-29&tipo=V");
  });

  // Regressão (auditoria de 24/10/2026): "/\evil.example" passava pelo "começa com / e não com //" e o
  // navegador o lê como //evil.example — a funcionária entrava e caía numa cópia falsa do login.
  it.each([
    ["barra invertida", "/\\evil.example/login"],
    ["barra + barra invertida", "//\\evil.example"],
    ["tab (o navegador descarta)", "/\t/evil.example"],
    ["quebra de linha", "/\n/evil.example"],
    ["protocolo relativo", "//evil.example"],
    ["endereço completo", "https://evil.example"],
    ["javascript:", "javascript:alert(1)"],
    ["sem barra", "inicio"],
    ["vazio", ""],
  ])("recusa %s", (_, volta) => {
    expect(destinoSeguro(volta)).toBeNull();
  });

  it("recusa o que não é texto", () => {
    expect(destinoSeguro(null)).toBeNull();
    expect(destinoSeguro(undefined)).toBeNull();
  });
});
