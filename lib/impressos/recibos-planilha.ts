/** Recibos do período em .xlsx para o contador: uma linha por recibo (cancelados inclusos) e o resumo por forma. */
import ExcelJS from "exceljs";

import { numeroRecibo, ROTULO_FORMA, ROTULO_TIPO } from "@/lib/vendas/recibos";
import type { ReciboDaLista } from "@/lib/vendas/recibos-servidor";

const REAIS = '"R$" #,##0.00';
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function nomeArquivoRecibos(mes: string) {
  return `recibos-${mes}.xlsx`;
}

export async function gerarPlanilhaRecibos(recibos: ReciboDaLista[], titulo: string, empresa: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = empresa;
  const ws = wb.addWorksheet("Recibos", { views: [{ state: "frozen", ySplit: 3 }] });
  ws.getCell("A1").value = `${empresa} · Recibos de ${titulo}`;
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.columns = [
    { key: "numero", width: 9 },
    { key: "data", width: 12 },
    { key: "situacao", width: 11 },
    { key: "tipo", width: 11 },
    { key: "orcamento", width: 11 },
    { key: "pagador", width: 32 },
    { key: "referente", width: 46 },
    { key: "forma", width: 18 },
    { key: "valor", width: 14 },
    { key: "motivo", width: 34 },
  ];
  const cab = ws.getRow(3);
  cab.values = ["Nº", "Data", "Situação", "Tipo", "Orçamento", "Recebido de", "Referente a", "Forma", "Valor", "Motivo do cancelamento"];
  cab.font = { bold: true };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6F1EA" } };

  for (const r of [...recibos].sort((a, b) => a.numero - b.numero)) {
    const l = ws.addRow({
      numero: numeroRecibo(r.numero),
      data: dataBr(r.dataPagamento),
      situacao: r.status === "emitido" ? "Emitido" : "Cancelado",
      tipo: ROTULO_TIPO[r.tipo],
      orcamento: r.orcamentoNumero ? numeroRecibo(r.orcamentoNumero) : "—",
      pagador: r.pagador,
      referente: r.referente,
      forma: ROTULO_FORMA[r.forma],
      valor: r.valorCentavos / 100,
      motivo: r.motivoCancelamento,
    });
    l.getCell("valor").numFmt = REAIS;
    if (r.status === "cancelado") l.font = { color: { argb: "FF8A7F76" }, strike: true };
  }

  const emitidos = recibos.filter((r) => r.status === "emitido");
  ws.addRow([]);
  const total = ws.addRow({ referente: "Total emitido (sem os cancelados)", valor: emitidos.reduce((t, r) => t + r.valorCentavos, 0) / 100 });
  total.font = { bold: true };
  total.getCell("valor").numFmt = REAIS;

  const resumo = wb.addWorksheet("Por forma de pagamento");
  resumo.columns = [
    { header: "Forma", key: "forma", width: 22 },
    { header: "Recibos", key: "n", width: 10 },
    { header: "Valor", key: "valor", width: 16 },
  ];
  resumo.getRow(1).font = { bold: true };
  for (const forma of Object.keys(ROTULO_FORMA) as (keyof typeof ROTULO_FORMA)[]) {
    const desta = emitidos.filter((r) => r.forma === forma);
    if (!desta.length) continue;
    resumo.addRow({ forma: ROTULO_FORMA[forma], n: desta.length, valor: desta.reduce((t, r) => t + r.valorCentavos, 0) / 100 }).getCell("valor").numFmt = REAIS;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
