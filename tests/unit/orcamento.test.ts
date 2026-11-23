/** Motor do orçamento: memória de cálculo, preço congelado, totais e situação. Números do protótipo. */
import { describe, expect, it } from "vitest";

import {
  calcularItem,
  calcularTotais,
  type Catalogo,
  chaveDePreco,
  type EntradaItem,
  itemNovo,
  numeroOrcamento,
  percentual,
  percentualDeTexto,
  precosDoCatalogo,
  precosDoItem,
  situacaoDoOrcamento,
} from "@/lib/vendas/orcamento";

const P = (id: string, categoria: Catalogo["produtos"][number]["categoria"], nome: string, unidade: "m" | "m2" | "un" | "vao", precoCentavos: number, larguraRoloCm: number | null = null) => ({
  id,
  categoria,
  nome,
  unidade,
  precoCentavos,
  larguraRoloCm,
  ativo: true,
});

const CATALOGO: Catalogo = {
  produtos: [
    P("linho", "tecido", "Linho Toscana", "m", 8990, 280),
    P("dv", "persiana", "Double vision", "m2", 24900),
    P("rolo", "persiana", "Rolô blackout", "m2", 18900),
    P("motorizado", "trilho", "Trilho motorizado", "m", 39000),
    P("suico", "trilho", "Trilho suíço", "m", 5800),
    P("abr", "acessorio", "Abraçadeira de tecido", "un", 2500),
    P("motor", "acessorio", "Motor para cortina", "un", 145000),
    P("ret", "servico", "Retirada de cortina antiga", "vao", 8000),
    P("inst", "servico", "Instalação", "vao", 6000),
  ],
  modelos: [{ id: "wave", nome: "Prega wave", fatorFranzimento: 2.5, precoMetroCentavos: 2800, ativo: true }],
  sobraTrilhoCm: 20,
  areaMinimaPersianaCm2: 15000,
};

const cortina = (extra: Partial<EntradaItem> = {}): EntradaItem => ({ ...itemNovo("c1", "cortina", CATALOGO), larguraCm: 320, alturaCm: 270, cor: "Areia", ...extra });
const persiana = (extra: Partial<EntradaItem> = {}): EntradaItem => ({ ...itemNovo("p1", "persiana", CATALOGO), produtoId: "dv", larguraCm: 140, alturaCm: 160, ...extra });

describe("item novo", () => {
  it("escolhe o primeiro ativo; trilho comum (não o motorizado), motor e instalação pelo nome", () => {
    const i = itemNovo("x", "cortina", CATALOGO);
    expect(i).toMatchObject({ produtoId: "linho", modeloId: "wave", trilhoId: "suico", motorId: "motor", instalacaoId: "inst", motorizado: false });
    expect(itemNovo("y", "acessorio", CATALOGO)).toMatchObject({ produtoId: "abr", instalacaoId: null, trilhoId: null });
  });
});

describe("cortina", () => {
  it("tecido × franzimento, confecção por metro, trilho com sobra e instalação (sala do protótipo)", () => {
    const c = calcularItem(cortina(), precosDoCatalogo(cortina(), CATALOGO));
    expect(c.linhas.map((l) => [l.rotulo, l.valorCentavos])).toEqual([
      ["Tecido", 71920], // 8,00 m × R$ 89,90
      ["Confecção", 22400], // 8,00 m × R$ 28,00
      ["Trilho", 19720], // 3,40 m × R$ 58,00
      ["Instalação", 6000],
    ]);
    expect(c.linhas[0]!.memoria).toBe("3,20 m × 2,5 = 8,00 m × R$ 89,90");
    expect(c.linhas[2]!.memoria).toBe("(3,20 m + 0,20 m de sobra) = 3,40 m × R$ 58,00 (trilho suíço)");
    expect(c.unitarioCentavos).toBe(120040);
    expect(c.descricao).toBe("Cortina · prega wave · Linho Toscana · Areia");
    expect(c.medidas).toBe("3,20 × 2,70 m");
    expect(c.faltando).toEqual([]);
  });

  it("motorizada soma o motor; quantidade multiplica o item inteiro", () => {
    const i = cortina({ motorizado: true, quantidade: 2 });
    const c = calcularItem(i, precosDoCatalogo(i, CATALOGO));
    expect(c.linhas.at(-2)).toMatchObject({ rotulo: "Motor", valorCentavos: 145000 });
    expect(c.unitarioCentavos).toBe(120040 + 145000);
    expect(c.totalCentavos).toBe((120040 + 145000) * 2);
    expect(c.descricao).toContain("motorizada");
  });

  it("sem trilho e sem instalação, só tecido e confecção", () => {
    const i = cortina({ trilhoId: null, instalacaoId: null });
    expect(calcularItem(i, precosDoCatalogo(i, CATALOGO)).unitarioCentavos).toBe(71920 + 22400);
  });

  it("altura maior que o rolo avisa; falta de medida zera o item e diz o que falta", () => {
    const alta = cortina({ alturaCm: 300 });
    expect(calcularItem(alta, precosDoCatalogo(alta, CATALOGO)).avisos[0]).toContain("maior que a largura do rolo (2,80 m)");
    const semLargura = cortina({ larguraCm: null });
    const c = calcularItem(semLargura, precosDoCatalogo(semLargura, CATALOGO));
    expect(c.faltando).toEqual(["largura"]);
    expect(c.totalCentavos).toBe(0);
    expect(c.linhas).toEqual([]);
  });
});

describe("persiana, trilho, acessório e serviço", () => {
  it("persiana por m² com instalação (escritório do protótipo)", () => {
    const c = calcularItem(persiana(), precosDoCatalogo(persiana(), CATALOGO));
    expect(c.linhas[0]).toEqual({ rotulo: "Persiana", memoria: "1,40 m × 1,60 m = 2,24 m² × R$ 249,00", valorCentavos: 55776 });
    expect(c.unitarioCentavos).toBe(55776 + 6000);
  });

  it("persiana pequena cobra a área mínima", () => {
    const i = persiana({ produtoId: "rolo", larguraCm: 80, alturaCm: 100, instalacaoId: null });
    const c = calcularItem(i, precosDoCatalogo(i, CATALOGO));
    expect(c.linhas[0]!.memoria).toBe("0,80 m × 1,00 m = 0,80 m² → mínimo 1,50 m² × R$ 189,00");
    expect(c.unitarioCentavos).toBe(28350);
  });

  it("trilho avulso com sobra; acessório e serviço por unidade", () => {
    const tr = { ...itemNovo("t", "trilho", CATALOGO), produtoId: "suico", larguraCm: 200 };
    expect(calcularItem(tr, precosDoCatalogo(tr, CATALOGO)).unitarioCentavos).toBe(12760); // 2,20 × 58
    const ac = { ...itemNovo("a", "acessorio", CATALOGO), quantidade: 4 };
    expect(calcularItem(ac, precosDoCatalogo(ac, CATALOGO)).totalCentavos).toBe(10000);
    const sv = { ...itemNovo("s", "servico", CATALOGO), produtoId: "ret" };
    expect(calcularItem(sv, precosDoCatalogo(sv, CATALOGO)).linhas[0]!.memoria).toBe("1 vão × R$ 80,00 (retirada de cortina antiga)");
  });
});

describe("preço congelado no item", () => {
  const caro: Catalogo = { ...CATALOGO, produtos: CATALOGO.produtos.map((p) => (p.id === "linho" ? { ...p, precoCentavos: 12000 } : p)) };

  it("mudar medida mantém o preço da época; trocar o produto pega o preço atual", () => {
    const original = cortina();
    const congelado = { chave: chaveDePreco(original), precos: precosDoCatalogo(original, CATALOGO) };
    const maisLarga = { ...original, larguraCm: 400 };
    expect(precosDoItem(maisLarga, caro, congelado).produto!.precoCentavos).toBe(8990);
    const motorizada = { ...original, motorizado: true };
    expect(precosDoItem(motorizada, caro, congelado).produto!.precoCentavos).toBe(12000);
  });

  it("a chave ignora o motor enquanto a cortina é manual", () => {
    expect(chaveDePreco(cortina({ motorId: "outro" }))).toBe(chaveDePreco(cortina()));
  });
});

describe("totais", () => {
  it("subtotal, desconto % arredondado no centavo e deslocamento", () => {
    const t = calcularTotais([120040, 61776], { modo: "pct", valor: 500 }, 5000);
    expect(t).toEqual({ subtotal: 181816, desconto: 9091, total: 181816 - 9091 + 5000 });
  });

  it("desconto em reais não passa do subtotal", () => {
    expect(calcularTotais([10000], { modo: "brl", valor: 50000 }, 0)).toEqual({ subtotal: 10000, desconto: 10000, total: 0 });
  });

  it("percentual digitado", () => {
    expect(percentualDeTexto("5")).toBe(500);
    expect(percentualDeTexto("5,5%")).toBe(550);
    expect(percentualDeTexto("100")).toBe(10000);
    expect(percentualDeTexto("101")).toBeNull();
    expect(percentualDeTexto("abc")).toBeNull();
    expect(percentual(500)).toBe("5%");
    expect(percentual(550)).toBe("5,50%");
  });
});

describe("situação e número", () => {
  it("enviado com validade no passado é vencido; número com 4 dígitos", () => {
    expect(situacaoDoOrcamento("enviado", "2026-10-01", "2026-10-25")).toBe("vencido");
    expect(situacaoDoOrcamento("enviado", "2026-10-25", "2026-10-25")).toBe("enviado");
    expect(situacaoDoOrcamento("aprovado", "2026-10-01", "2026-10-25")).toBe("aprovado");
    expect(numeroOrcamento(118)).toBe("0118");
  });
});
