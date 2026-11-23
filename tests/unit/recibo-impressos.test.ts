/** Recibo em PDF (meia folha, duas vias numa folha) e a planilha de recibos do contador. */
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { gerarReciboPdf, nomeArquivoRecibo } from "@/lib/impressos/recibo";
import { gerarPlanilhaRecibos } from "@/lib/impressos/recibos-planilha";
import type { ReciboDaLista } from "@/lib/vendas/recibos-servidor";

const DOC = {
  numero: 46,
  valor_centavos: 177765,
  pagador: "Mariana Couto (exemplo)",
  referente: "à quitação do orçamento nº 0118 (Sala e Escritório)",
  forma: "pix" as const,
  data_pagamento: "2026-02-09",
  status: "emitido" as const,
  cancelado_em: null,
  motivo_cancelamento: "",
  empresa: { nome: "Cristina's Decorações", razao_social: "", cnpj: "", telefone: "", cidade_uf: "Campinas/SP" },
};

const paginas = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;

describe("recibo em PDF", () => {
  it("duas vias cabem numa folha; uma via também; cancelado continua uma folha", async () => {
    expect(paginas(await gerarReciboPdf(DOC, 2, "teste"))).toBe(1);
    expect(paginas(await gerarReciboPdf(DOC, 1, "teste"))).toBe(1);
    expect(paginas(await gerarReciboPdf({ ...DOC, status: "cancelado", cancelado_em: "2026-02-10T12:00:00Z", motivo_cancelamento: "Digitado errado" }, 2, "teste"))).toBe(1);
    expect(nomeArquivoRecibo(46)).toBe("Recibo-0046.pdf");
  });
});

describe("planilha de recibos", () => {
  const r = (numero: number, valor: number, status: "emitido" | "cancelado", forma: ReciboDaLista["forma"]): ReciboDaLista => ({
    id: String(numero),
    numero,
    tipo: "sinal",
    orcamentoId: "o",
    orcamentoNumero: 118,
    pagador: "Cliente",
    referente: "ao sinal do orçamento nº 0118",
    valorCentavos: valor,
    forma,
    dataPagamento: "2026-10-05",
    status,
    motivoCancelamento: status === "cancelado" ? "Erro" : "",
    canceladoEm: null,
  });

  it("uma linha por recibo em ordem de número; o total não conta cancelado; resumo por forma", async () => {
    const buf = await gerarPlanilhaRecibos([r(3, 30000, "emitido", "dinheiro"), r(1, 10000, "emitido", "pix"), r(2, 99900, "cancelado", "pix")], "outubro de 2026", "Loja");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Recibos")!;
    expect([4, 5, 6].map((l) => ws.getRow(l).getCell(1).value)).toEqual(["0001", "0002", "0003"]);
    expect(ws.getRow(5).getCell(3).value).toBe("Cancelado");
    const total = ws.getRow(8);
    expect(total.getCell(7).value).toBe("Total emitido (sem os cancelados)");
    expect(total.getCell(9).value).toBe(400);
    const resumo = wb.getWorksheet("Por forma de pagamento")!;
    expect(resumo.getRow(2).values).toEqual([undefined, "PIX", 1, 100]);
    expect(resumo.getRow(3).values).toEqual([undefined, "Dinheiro", 1, 300]);
  });
});
