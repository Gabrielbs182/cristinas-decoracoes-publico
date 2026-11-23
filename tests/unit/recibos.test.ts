/** Recibos: texto do referente, valor sugerido e datas. */
import { describe, expect, it } from "vitest";

import { cidadeDoRecibo, dataPorExtenso, listaHumana, textoReferente, valorSugerido } from "@/lib/vendas/recibos";

describe("referente", () => {
  it("de orçamento: tipo com a preposição certa, número e ambientes", () => {
    expect(textoReferente("sinal", { orcamentoNumero: 118, ambientes: ["Sala", "Escritório"] })).toBe("ao sinal do orçamento nº 0118 (Sala e Escritório)");
    expect(textoReferente("parcela", { orcamentoNumero: 7, ambientes: ["Sala"] })).toBe("à parcela do orçamento nº 0007 (Sala)");
    expect(textoReferente("quitacao", { orcamentoNumero: 7, ambientes: [] })).toBe("à quitação do orçamento nº 0007");
  });

  it("avulso: põe o 'a' só quando falta", () => {
    expect(textoReferente("avulso", { avulso: "conserto de varão" })).toBe("a conserto de varão");
    expect(textoReferente("avulso", { avulso: "à lavagem de duas cortinas" })).toBe("à lavagem de duas cortinas");
  });

  it("lista humana", () => {
    expect(listaHumana(["Sala", "Quarto", "Escritório"])).toBe("Sala, Quarto e Escritório");
    expect(listaHumana(["Sala"])).toBe("Sala");
    expect(listaHumana([])).toBe("");
  });
});

describe("valor sugerido", () => {
  it("sinal é metade do total, sem passar do saldo; quitação é o saldo; parcela não sugere", () => {
    expect(valorSugerido("sinal", 177765, 177765)).toBe(88883);
    expect(valorSugerido("sinal", 100000, 20000)).toBe(20000);
    expect(valorSugerido("quitacao", 100000, 38000)).toBe(38000);
    expect(valorSugerido("parcela", 100000, 38000)).toBeNull();
  });
});

describe("data e cidade", () => {
  it("por extenso, sem escorregar de fuso", () => {
    expect(dataPorExtenso("2026-02-09")).toBe("9 de fevereiro de 2026");
    expect(dataPorExtenso("2026-12-31")).toBe("31 de dezembro de 2026");
    expect(cidadeDoRecibo("Campinas/SP")).toBe("Campinas");
    expect(cidadeDoRecibo("")).toBe("");
  });
});
