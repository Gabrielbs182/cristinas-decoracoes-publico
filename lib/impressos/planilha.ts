/**
 * Planilha .xlsx da semana no MESMO layout do sistema antigo (Pontos/src/pontos/xlsx_writer.py):
 * aba "Geral", A–H uma linha por dia × funcionária, I separador, J–P resumo do banco.
 * K (saldo anterior) já inclui ajustes manuais, como o sistema antigo fazia ao editar o saldos.csv,
 * então M = K + L continua valendo na planilha.
 */
import ExcelJS from "exceljs";

import { hhmm, isoDow, somarDias } from "@/lib/ponto";

import type { FechamentoCarregado } from "./dados";

const HEADER_AH = ["Data", "Funcionario", "Entrada", "Saída para Almoço", "Volta do Almoço", "Saída", "Horas Trabalhadas", "Horas Extras"];
const HEADER_JP = ["Funcionario", "Hora Extra", "Hora Extra Total da semana", "Acumulado", "Proxima Semana", "Hora de corte", ""];
const LARGURAS: Record<string, number> = { A: 12, B: 20, C: 14, D: 14, E: 14, F: 14, G: 14, H: 14, I: 4, J: 20, K: 14, L: 14, M: 14, N: 14, O: 14, P: 18 };

const preenchimento = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const FILL_HEADER = preenchimento("FFD9E1F2");
const FILL_FALTA = preenchimento("FFFFF2CC");
const FILL_FECHOU = preenchimento("FFC6EFCE");
const fina = { style: "thin" as const, color: { argb: "FF000000" } };

/** Dia sem horário por ocorrência: a planilha mostra o nome dela (o sistema antigo escrevia "Justificado" à mão). */
const ROTULO_OCORRENCIA: Record<string, string> = {
  feriado: "Feriado",
  falta_justificada: "Justificado",
  atestado: "Atestado",
  folga: "Folga",
};
const BORDA: Partial<ExcelJS.Borders> = { top: fina, left: fina, bottom: fina, right: fina };

export function nomeArquivoPlanilha(segunda: string): string {
  const sexta = somarDias(segunda, 4);
  const dm = (d: string) => `${d.slice(8, 10)}_${d.slice(5, 7)}`;
  return `${segunda.replaceAll("-", "")} - ${dm(segunda)}-${dm(sexta)}.xlsx`;
}

export async function gerarPlanilha(f: FechamentoCarregado): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = f.empresa.nome;
  const ws = wb.addWorksheet("Geral", { views: [{ state: "frozen", ySplit: 1 }] });
  for (const [col, w] of Object.entries(LARGURAS)) ws.getColumn(col).width = w;

  const cabecalho = (linha: number, colInicial: number, titulos: string[]) => {
    titulos.forEach((t, i) => {
      const c = ws.getCell(linha, colInicial + i);
      c.value = t;
      c.font = { bold: true };
      c.fill = FILL_HEADER;
      c.border = BORDA;
      c.alignment = { horizontal: "center", vertical: "middle" };
    });
  };
  cabecalho(1, 1, HEADER_AH);
  cabecalho(1, 10, HEADER_JP);

  // A–H: só dias úteis, em ordem de data e, no mesmo dia, de nome (como o sistema antigo).
  const linhas = f.funcionarias
    .flatMap((fu) => fu.dias.filter((d) => isoDow(d.data) <= 5).map((d) => ({ nome: fu.nome, d })))
    .sort((a, b) => a.d.data.localeCompare(b.d.data) || a.nome.localeCompare(b.nome, "pt-BR"));
  linhas.forEach(({ nome, d }, i) => {
    const r = i + 2;
    const ocorrencia = ROTULO_OCORRENCIA[d.situacao];
    const falta = !ocorrencia && d.trabalhadas_min === null;
    const vazio = ocorrencia ?? "Falta";
    const valores = [
      d.data.replaceAll("-", "/"),
      nome,
      d.entrada ?? vazio,
      d.saida_almoco ?? vazio,
      d.volta_almoco ?? vazio,
      d.saida ?? vazio,
      ocorrencia || d.trabalhadas_min === null ? vazio : hhmm(d.trabalhadas_min),
      hhmm(d.extra_min),
    ];
    valores.forEach((v, c) => {
      const cel = ws.getCell(r, c + 1);
      cel.value = v;
      cel.border = BORDA;
      if (falta) cel.fill = FILL_FALTA;
    });
  });

  // J–P: resumo por funcionária, em ordem alfabética.
  f.funcionarias.forEach((fu, i) => {
    const r = i + 2;
    const res = fu.resultado;
    const valores = [
      fu.nome,
      hhmm(res.saldo_anterior_min + res.ajustes_min),
      hhmm(res.extras_semana_min),
      hhmm(res.acumulado_min),
      hhmm(res.proxima_semana_min),
      hhmm(f.regras.horaCorteMin),
      "",
    ];
    valores.forEach((v, c) => {
      const cel = ws.getCell(r, 10 + c);
      cel.value = v;
      cel.border = BORDA;
      if (res.fechou_corte && c < 6) cel.fill = FILL_FECHOU;
    });
    ws.getCell(r, 16).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Justificado,Ausência,Horário negativo"'],
      showErrorMessage: true,
      errorTitle: "Status inválido",
      error: "Selecione uma das opções: Justificado, Ausência, Horário negativo",
    };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
