/** Fotografia do fechamento e impressos (planilha no layout antigo, espelho em PDF de uma página). */
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { FechamentoCarregado } from "@/lib/impressos/dados";
import { gerarEspelhoPdf, nomeArquivoEspelho } from "@/lib/impressos/espelho";
import { gerarPlanilha, nomeArquivoPlanilha } from "@/lib/impressos/planilha";
import { avaliarSemana, REGRAS_PADRAO } from "@/lib/ponto";
import { impedimentosDoFechamento, montarFechamento } from "@/lib/ponto/fechamento";

import { batidas, lanc } from "./ponto/ajuda";

const SEGUNDA = "2026-02-02";
const b = (data: string, horas: string[], iomd?: number[]) => batidas(horas, iomd).map((x) => ({ ...x, data }));

describe("montarFechamento", () => {
  const bat = [
    ...b("2026-02-02", ["07:01", "12:19", "17:00"], [0, 1, 3]), // falta a volta: resolvido como "manter"
    ...b("2026-02-03", ["07:00", "12:00", "13:00", "18:00"]),
    ...b("2026-02-07", ["08:00", "10:00"]), // sábado: entra no espelho, fora do banco
  ];
  const sem = avaliarSemana({ segunda: SEGUNDA, regras: REGRAS_PADRAO, feriados: {}, batidas: bat, lancamentos: [], saldoAnteriorMin: 470 });
  const manter = lanc({ tipo: "resolver_pendencia", codigo: "FALTA_VOLTA_ALMOCO", assinatura: sem.dias[0]!.assinatura, motivo: "Saiu para consulta" });
  const r = avaliarSemana({
    segunda: SEGUNDA,
    regras: REGRAS_PADRAO,
    feriados: {},
    batidas: bat,
    lancamentos: [{ ...manter, data: "2026-02-02" }],
    saldoAnteriorMin: 470,
  });
  const { resultados, dias } = montarFechamento(SEGUNDA, [{ id: "f1", resultado: r }]);

  it("resultado espelha o banco do motor e aponta o caminho do PDF", () => {
    expect(resultados).toEqual([
      expect.objectContaining({
        funcionaria_id: "f1",
        saldo_anterior_min: 470,
        extras_semana_min: 60,
        acumulado_min: 530,
        fechou_corte: true,
        proxima_semana_min: 50,
        espelho_path: `f1/${SEGUNDA}.pdf`,
      }),
    ]);
  });

  it("colunas de horário vêm do tipo da batida, não da posição (17:00 é saída, não volta)", () => {
    const seg02 = dias.find((d) => d.data === "2026-02-02")!;
    expect(seg02).toMatchObject({ entrada: "07:01", saida_almoco: "12:19", volta_almoco: null, saida: "17:00", ajustado: true, situacao: "ajustado" });
  });

  it("dias úteis sempre; fim de semana só com batida, e sem extra", () => {
    expect(dias.map((d) => d.data)).toEqual(["2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06", "2026-02-07"]);
    expect(dias.find((d) => d.data === "2026-02-07")!.extra_min).toBe(0);
  });

  it("impedimentos explicam por que não dá para fechar", () => {
    expect(
      impedimentosDoFechamento({ temBatidas: true, status: "aberta", bloqueios: 2, idsDesconhecidos: 1, solicitacoesPendentes: 1, semanaAbertaAnterior: "2026-01-26" }),
    ).toEqual(["3 pendência(s) ainda bloqueiam o fechamento.", "1 solicitação(ões) das funcionárias sem resposta.", "A semana anterior (26/01/2026) ainda está aberta."]);
    expect(impedimentosDoFechamento({ temBatidas: true, status: "aberta", bloqueios: 0, idsDesconhecidos: 0, solicitacoesPendentes: 0, semanaAbertaAnterior: null })).toEqual([]);
  });
});

function fechamentoDeExemplo(): FechamentoCarregado {
  const dia = (data: string, entrada: string | null, trab: number | null, extra: number, situacao: string) => ({
    segunda: SEGUNDA,
    funcionaria_id: "f1",
    data,
    entrada,
    saida_almoco: entrada ? "12:00" : null,
    volta_almoco: entrada ? "13:00" : null,
    saida: entrada ? "17:00" : null,
    trabalhadas_min: trab,
    extra_min: extra,
    situacao,
    ajustado: situacao === "ajustado",
  });
  return {
    segunda: SEGUNDA,
    fechadaEm: "2026-02-09T11:00:00Z",
    regras: REGRAS_PADRAO,
    empresa: { nome: "Cristina's Decorações", cnpj: "", telefone: "", endereco: "", cidadeUf: "" },
    funcionarias: [
      {
        id: "f1",
        nome: "Ana Exemplo",
        resultado: {
          segunda: SEGUNDA,
          funcionaria_id: "f1",
          saldo_anterior_min: 400,
          extras_semana_min: 60,
          ajustes_min: 75,
          acumulado_min: 535,
          fechou_corte: true,
          proxima_semana_min: 55,
          trabalhadas_min: 2160,
          dias_trabalhados: 4,
          espelho_path: null,
        },
        dias: [
          dia("2026-02-02", "07:00", 540, 0, "ok"),
          dia("2026-02-03", null, null, 0, "falta"),
          dia("2026-02-04", "07:00", 600, 60, "ajustado"),
          dia("2026-02-05", null, null, 0, "falta_justificada"),
          dia("2026-02-06", "07:00", 480, 0, "ok"),
        ],
        ajustes: [{ minutos: 75, motivo: "Ponto justificado pela funcionária" }],
      },
    ],
  };
}

describe("planilha no layout do sistema antigo", () => {
  it("cabeçalhos, valores, K com ajuste, cores, ocorrência e lista de status", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await gerarPlanilha(fechamentoDeExemplo())) as never);
    const ws = wb.getWorksheet("Geral")!;
    const v = (c: string) => ws.getCell(c).value;
    const cor = (c: string) => (ws.getCell(c).fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

    expect([v("A1"), v("H1"), v("J1"), v("N1")]).toEqual(["Data", "Horas Extras", "Funcionario", "Proxima Semana"]);
    expect([v("A2"), v("B2"), v("C2"), v("G2"), v("H2")]).toEqual(["2026/02/02", "Ana Exemplo", "07:00", "09:00", "00:00"]);
    expect([v("C3"), v("G3")]).toEqual(["Falta", "Falta"]);
    expect(cor("A3")).toBe("FFFFF2CC");
    expect([v("C5"), v("G5")]).toEqual(["Justificado", "Justificado"]);
    expect(cor("A5")).toBeUndefined();
    // K = saldo anterior + ajuste (como o sistema antigo fazia ao editar o saldos.csv): M = K + L.
    expect([v("K2"), v("L2"), v("M2"), v("N2"), v("O2")]).toEqual(["07:55", "01:00", "08:55", "00:55", "08:00"]);
    expect(cor("J2")).toBe("FFC6EFCE");
    expect(ws.getCell("P2").dataValidation?.formulae).toEqual(['"Justificado,Ausência,Horário negativo"']);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("nome do arquivo igual ao do sistema antigo", () => {
    expect(nomeArquivoPlanilha("2026-02-02")).toBe("20260202 - 02_02-06_02.xlsx");
    expect(nomeArquivoPlanilha("2026-09-28")).toBe("20260928 - 28_09-02_10.xlsx");
  });
});

describe("espelho em PDF", () => {
  it("é um PDF de uma página só, mesmo com ajustes e dias marcados", async () => {
    const f = fechamentoDeExemplo();
    const pdf = await gerarEspelhoPdf({ empresa: f.empresa, segunda: SEGUNDA, fechadaEm: f.fechadaEm, regras: f.regras, funcionaria: f.funcionarias[0]!, versao: "teste" });
    const bruto = pdf.toString("latin1");
    expect(bruto.startsWith("%PDF-")).toBe(true);
    expect(bruto.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(1);
  });

  it("nome do arquivo legível e sem caractere proibido", () => {
    expect(nomeArquivoEspelho("Ana/Exemplo", "2026-02-02")).toBe("Espelho - Ana_Exemplo - 02-02-2026 a 06-02-2026.pdf");
  });
});
