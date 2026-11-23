/** Vendas: dinheiro e medidas como inteiros, e as regras de cálculo do orçamento. */
import { describe, expect, it } from "vitest";

import { areaPersiana, exemploTecido, regraDaCategoria, tecidoCm, trilhoCm, valorCentavos } from "@/lib/vendas/calculo";
import {
  brl,
  centavosDeTexto,
  cm2DeMetrosQuadrados,
  cmDeMetros,
  documentoFormatado,
  fator,
  fatorDeTexto,
  metros,
  metrosQuadrados,
  reaisParaCampo,
  whatsappDoTelefone,
} from "@/lib/vendas/numeros";

describe("dinheiro", () => {
  it("formata e lê no jeito brasileiro, sem perder centavo", () => {
    expect(brl(8990)).toBe("R$ 89,90");
    expect(brl(145000)).toBe("R$ 1.450,00");
    expect(reaisParaCampo(8990)).toBe("89,90");
    expect(centavosDeTexto("89,90")).toBe(8990);
    expect(centavosDeTexto("R$ 1.450,00")).toBe(145000);
    expect(centavosDeTexto("1450")).toBe(145000);
    expect(centavosDeTexto("1.450")).toBe(145000);
    expect(centavosDeTexto("89.9")).toBe(8990);
    expect(centavosDeTexto("0,1")).toBe(10);
    // 0,1 + 0,2 em ponto flutuante daria 0,30000000000000004; aqui é inteiro do começo ao fim.
    expect(centavosDeTexto("0,29")).toBe(29);
    for (const ruim of ["", "abc", "1,234", "1,2,3", "-5", "12.34.5"]) expect(centavosDeTexto(ruim), ruim).toBeNull();
  });
});

describe("medidas", () => {
  it("metros e m² viram centímetros inteiros", () => {
    expect(cmDeMetros("3,20")).toBe(320);
    expect(cmDeMetros("2.8")).toBe(280);
    expect(cmDeMetros("2,80 m")).toBe(280);
    expect(cmDeMetros("3,205")).toBeNull();
    expect(metros(320)).toBe("3,20 m");
    expect(cm2DeMetrosQuadrados("1,50")).toBe(15000);
    expect(cm2DeMetrosQuadrados("1,5 m²")).toBe(15000);
    expect(metrosQuadrados(15000)).toBe("1,50 m²");
  });

  it("fator de franzimento entre 1 e 4", () => {
    expect(fatorDeTexto("2,5")).toBe(2.5);
    expect(fatorDeTexto("2")).toBe(2);
    expect(fatorDeTexto("0,9")).toBeNull();
    expect(fatorDeTexto("4,5")).toBeNull();
    expect(fator(2.5)).toBe("2,5");
    expect(fator(2)).toBe("2,0");
    expect(fator(2.25)).toBe("2,25");
  });
});

describe("cálculo do orçamento", () => {
  it("tecido: largura × franzimento, arredondando para cima no centímetro", () => {
    expect(tecidoCm(320, 2.5)).toBe(800);
    expect(tecidoCm(321, 2.5)).toBe(803); // 802,5 → 803
    expect(tecidoCm(300, 2)).toBe(600);
    // Sem ruído de ponto flutuante: 3,30 × 2,1 = 6,93 exatos.
    expect(tecidoCm(330, 2.1)).toBe(693);
  });

  it("persiana cobra a área mínima quando o vão é pequeno", () => {
    expect(areaPersiana(140, 160, 15000)).toEqual({ areaCm2: 22400, cobradaCm2: 22400, minimaAplicada: false });
    expect(areaPersiana(80, 100, 15000)).toEqual({ areaCm2: 8000, cobradaCm2: 15000, minimaAplicada: true });
  });

  it("trilho leva a sobra; valor arredonda no centavo", () => {
    expect(trilhoCm(320, 20)).toBe(340);
    expect(valorCentavos(340, "m", 5800)).toBe(19720); // 3,40 m × R$ 58,00
    expect(valorCentavos(22400, "m2", 24900)).toBe(55776); // 2,24 m² × R$ 249,00
    expect(valorCentavos(803, "m", 8990)).toBe(72190); // 8,03 × 89,90 = 721,897 → 721,90
    expect(valorCentavos(2, "un", 4800)).toBe(9600);
  });

  it("a regra do catálogo usa os números configurados", () => {
    const regras = { sobraTrilhoCm: 25, areaMinimaPersianaCm2: 12000 };
    const modelos = [
      { nome: "Prega wave", fatorFranzimento: 2.5, precoMetroCentavos: 2800 },
      { nome: "Ilhós", fatorFranzimento: 2, precoMetroCentavos: 1800 },
    ];
    expect(regraDaCategoria("tecido", regras, modelos)).toContain("(prega wave 2,5 · ilhós 2,0)");
    expect(regraDaCategoria("persiana", regras, modelos)).toContain("1,20 m²");
    expect(regraDaCategoria("trilho", regras, modelos)).toContain("0,25 m de sobra");
    expect(exemploTecido(300, modelos[0]!, 8990)).toBe("3,00 m × 2,5 = 7,50 m de tecido → tecido R$ 674,25 + confecção R$ 210,00");
  });
});

describe("cliente", () => {
  it("documento e WhatsApp", () => {
    expect(documentoFormatado("31244892017")).toBe("312.448.920-17");
    expect(documentoFormatado("12345678000190")).toBe("12.345.678/0001-90");
    expect(whatsappDoTelefone("(19) 99134-2280")).toBe("https://wa.me/5519991342280");
    expect(whatsappDoTelefone("+55 19 3251-8890")).toBe("https://wa.me/551932518890");
    expect(whatsappDoTelefone("99134-2280")).toBeNull();
  });
});
