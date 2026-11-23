/** PDF do orçamento: uma página quando cabe, quebra de página quando não cabe, nome do arquivo. */
import { describe, expect, it } from "vitest";

import { gerarOrcamentoPdf } from "@/lib/impressos/orcamento";
import { type DocumentoOrcamento, nomeArquivoOrcamento, textoValidade } from "@/lib/vendas/documento";

const item = (n: number) => ({
  descricao: `Cortina · prega wave · Linho Toscana · Areia ${n}`,
  medidas: "3,20 × 2,70 m",
  quantidade: 1,
  unitario_centavos: 120040,
  total_centavos: 120040,
});

const doc = (itens: number): DocumentoOrcamento => ({
  numero: 118,
  status: "enviado",
  vencido: false,
  criado_em: "2026-10-20T13:00:00Z",
  enviado_em: "2026-10-21T13:00:00Z",
  valido_ate: "2026-11-20",
  validade_dias: 30,
  respondido_em: null,
  aprovado_pelo_link: false,
  cliente: { nome: "Mariana Couto (exemplo)", telefone: "(19) 99134-2280" },
  endereco_obra: "R. das Hortênsias, 240 — Alphaville Dom Pedro, Campinas/SP",
  prazo_entrega: "20 dias úteis após o sinal",
  condicoes_pagamento: "50% de sinal e 50% na instalação",
  obs_cliente: "Medidas conferidas na visita técnica.",
  subtotal_centavos: itens * 120040,
  desconto_centavos: 0,
  deslocamento_centavos: 5000,
  total_centavos: itens * 120040 + 5000,
  vendedora: "Cristina",
  empresa: { nome: "Cristina's Decorações", razao_social: "", cnpj: "", telefone: "(19) 3333-0000", email: "", endereco: "", cidade_uf: "Campinas/SP" },
  ambientes: [
    { nome: "Sala", itens: Array.from({ length: Math.ceil(itens / 2) }, (_, i) => item(i)) },
    { nome: "Quarto", itens: Array.from({ length: Math.floor(itens / 2) }, (_, i) => item(i)) },
  ],
});

const paginas = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;

describe("orçamento em PDF", () => {
  it("orçamento pequeno cabe em uma página", async () => {
    const pdf = await gerarOrcamentoPdf(doc(3), "teste");
    expect(pdf.toString("latin1").startsWith("%PDF-")).toBe(true);
    expect(paginas(pdf)).toBe(1);
  });

  it("orçamento grande quebra a tabela em várias páginas", async () => {
    expect(paginas(await gerarOrcamentoPdf(doc(60), "teste"))).toBeGreaterThanOrEqual(3);
  });

  it("nome do arquivo sem acento e validade em texto", () => {
    expect(nomeArquivoOrcamento({ numero: 7, cliente: { nome: "Clínica Viver Bem", telefone: "" } })).toBe("Orcamento-0007-Clinica-Viver-Bem.pdf");
    expect(textoValidade({ valido_ate: "2026-11-20", validade_dias: 30 })).toBe("Válido até 20/11/2026");
    expect(textoValidade({ valido_ate: null, validade_dias: 30 })).toBe("Validade de 30 dias a partir do envio");
  });
});
