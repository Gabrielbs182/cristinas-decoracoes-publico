/**
 * Fotografia do fechamento: transforma o resultado do motor nas linhas que `fechar_semana` grava.
 * Puro (sem banco), para ser testado e reaproveitado.
 */
import type { ResultadoDia, TipoBatida } from "./dia";
import type { ResultadoSemana } from "./semana";

export interface LinhaResultado {
  funcionaria_id: string;
  saldo_anterior_min: number;
  extras_semana_min: number;
  ajustes_min: number;
  acumulado_min: number;
  fechou_corte: boolean;
  proxima_semana_min: number;
  trabalhadas_min: number;
  dias_trabalhados: number;
  espelho_path: string;
}

export interface LinhaDiaFechado {
  funcionaria_id: string;
  data: string;
  entrada: string | null;
  saida_almoco: string | null;
  volta_almoco: string | null;
  saida: string | null;
  trabalhadas_min: number | null;
  extra_min: number;
  situacao: string;
  ajustado: boolean;
}

export const caminhoEspelho = (funcionariaId: string, segunda: string) => `${funcionariaId}/${segunda}.pdf`;

/** Horário da batida de cada tipo (pela classificação do motor, não pela posição). */
function horario(dia: ResultadoDia, tipo: TipoBatida): string | null {
  return dia.batidas.find((b) => b.tipo === tipo && !b.excedente)?.hora ?? null;
}

/** Dias que entram no espelho: os úteis sempre; sábado, domingo e feriado só se houve batida. */
export function diasDoEspelho(r: ResultadoSemana): ResultadoDia[] {
  return r.dias.filter((d) => d.dow <= 5 || d.batidas.some((b) => !b.desconsiderada));
}

export function montarFechamento(segunda: string, funcionarias: { id: string; resultado: ResultadoSemana }[]) {
  const resultados: LinhaResultado[] = [];
  const dias: LinhaDiaFechado[] = [];
  for (const { id, resultado: r } of funcionarias) {
    resultados.push({
      funcionaria_id: id,
      saldo_anterior_min: r.banco.saldoAnteriorMin,
      extras_semana_min: r.banco.extrasSemanaMin,
      ajustes_min: r.banco.ajustesMin,
      acumulado_min: r.banco.acumuladoMin,
      fechou_corte: r.banco.fechouCorte,
      proxima_semana_min: r.banco.proximaSemanaMin,
      trabalhadas_min: r.trabalhadasMin,
      dias_trabalhados: r.diasTrabalhados,
      espelho_path: caminhoEspelho(id, segunda),
    });
    for (const d of diasDoEspelho(r)) {
      dias.push({
        funcionaria_id: id,
        data: d.data,
        entrada: horario(d, "E"),
        saida_almoco: horario(d, "A"),
        volta_almoco: horario(d, "V"),
        saida: horario(d, "S"),
        trabalhadas_min: d.trabalhadasMin,
        extra_min: d.contaNoBanco ? d.extraMin : 0,
        situacao: d.situacao,
        ajustado: d.ajustado,
      });
    }
  }
  return { resultados, dias };
}

/** O que impede fechar (vazio = pode fechar). */
export function impedimentosDoFechamento(e: {
  temBatidas: boolean;
  status: "aberta" | "fechada";
  bloqueios: number;
  idsDesconhecidos: number;
  solicitacoesPendentes: number;
  semanaAbertaAnterior: string | null;
}): string[] {
  const out: string[] = [];
  if (e.status === "fechada") out.push("A semana já está fechada.");
  if (!e.temBatidas) out.push("A semana não tem batidas importadas.");
  if (e.bloqueios + e.idsDesconhecidos) out.push(`${e.bloqueios + e.idsDesconhecidos} pendência(s) ainda bloqueiam o fechamento.`);
  if (e.solicitacoesPendentes) out.push(`${e.solicitacoesPendentes} solicitação(ões) das funcionárias sem resposta.`);
  if (e.semanaAbertaAnterior) out.push(`A semana anterior (${e.semanaAbertaAnterior.split("-").reverse().join("/")}) ainda está aberta.`);
  return out;
}
