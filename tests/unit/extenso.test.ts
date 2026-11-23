/** Valor por extenso do recibo. */
import { describe, expect, it } from "vitest";

import { valorPorExtenso } from "@/lib/vendas/extenso";

describe("valor por extenso", () => {
  it.each([
    [0, "zero real"],
    [1, "um centavo"],
    [50, "cinquenta centavos"],
    [100, "um real"],
    [101, "um real e um centavo"],
    [1000, "dez reais"],
    [1500, "quinze reais"],
    [2100, "vinte e um reais"],
    [10000, "cem reais"],
    [10100, "cento e um reais"],
    [11100, "cento e onze reais"],
    [99999, "novecentos e noventa e nove reais e noventa e nove centavos"],
    [100000, "mil reais"],
    [100100, "mil e um reais"],
    [120000, "mil e duzentos reais"],
    [123400, "mil duzentos e trinta e quatro reais"],
    [177765, "mil setecentos e setenta e sete reais e sessenta e cinco centavos"],
    [250000, "dois mil e quinhentos reais"],
    [1000000, "dez mil reais"],
    [10100000, "cento e um mil reais"],
    [99999999, "novecentos e noventa e nove mil novecentos e noventa e nove reais e noventa e nove centavos"],
    [100000000, "um milhão de reais"],
    [150000000, "um milhão e quinhentos mil reais"],
    [100000100, "um milhão e um reais"],
    [200000050, "dois milhões de reais e cinquenta centavos"],
    [123456789, "um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete reais e oitenta e nove centavos"],
  ])("%i centavos → %s", (centavos, texto) => {
    expect(valorPorExtenso(centavos)).toBe(texto);
  });

  it("recusa valor negativo ou quebrado", () => {
    expect(() => valorPorExtenso(-1)).toThrow();
    expect(() => valorPorExtenso(1.5)).toThrow();
  });
});
