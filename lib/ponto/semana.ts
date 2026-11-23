/**
 * Semana de uma funcionária e banco de horas — port de calcular_resumos (pontos/relatorio.py).
 *
 *   K saldo anterior  +  L extras da semana  (+ ajustes manuais)  =  M acumulado
 *   fechou o corte  ⇔  M ≥ hora de corte − tolerância   → 1 dia pago
 *   N próxima semana =  fechou ? max(0, M − corte) : M
 */

import { avaliarDia, type BatidaCatraca, type Lancamento, type ResultadoDia } from "./dia";
import type { Jornada, Regras } from "./regras";
import { diasDaSemana } from "./tempo";

export interface ResumoBanco {
  saldoAnteriorMin: number;
  extrasSemanaMin: number;
  ajustesMin: number;
  acumuladoMin: number;
  fechouCorte: boolean;
  proximaSemanaMin: number;
  faltaParaCorteMin: number;
}

export function resumoBanco(regras: Regras, saldoAnteriorMin: number, extrasSemanaMin: number, ajustesMin = 0): ResumoBanco {
  const acumuladoMin = saldoAnteriorMin + extrasSemanaMin + ajustesMin;
  const fechouCorte = acumuladoMin >= regras.horaCorteMin - regras.toleranciaCorteMin;
  return {
    saldoAnteriorMin,
    extrasSemanaMin,
    ajustesMin,
    acumuladoMin,
    fechouCorte,
    proximaSemanaMin: fechouCorte ? Math.max(0, acumuladoMin - regras.horaCorteMin) : acumuladoMin,
    faltaParaCorteMin: Math.max(0, regras.horaCorteMin - acumuladoMin),
  };
}

export interface EntradaSemana {
  segunda: string;
  regras: Regras;
  jornada?: Jornada;
  /** data → nome do feriado */
  feriados: Record<string, string>;
  batidas: (BatidaCatraca & { data: string })[];
  lancamentos: (Lancamento & { data: string })[];
  saldoAnteriorMin: number;
  ajustesMin?: number;
}

export interface ResultadoSemana {
  segunda: string;
  /** Segunda a domingo. */
  dias: ResultadoDia[];
  trabalhadasMin: number;
  diasTrabalhados: number;
  banco: ResumoBanco;
  bloqueios: number;
  avisos: number;
  /** Há pendência que bloqueia: o banco ainda pode mudar. */
  provisoria: boolean;
}

export function avaliarSemana(e: EntradaSemana): ResultadoSemana {
  const dias: ResultadoDia[] = [];
  let saidaAnterior: number | null = null;

  for (const data of diasDaSemana(e.segunda)) {
    const dia = avaliarDia({
      data,
      regras: e.regras,
      jornada: e.jornada,
      feriado: e.feriados[data] ?? null,
      batidas: e.batidas.filter((b) => b.data === data),
      lancamentos: e.lancamentos.filter((l) => l.data === data),
      saidaDiaAnteriorSeg: saidaAnterior,
    });
    dias.push(dia);
    const saida = [...dia.batidas].reverse().find((b) => b.tipo === "S");
    saidaAnterior = saida && !dia.foraDoCalculo ? saida.horaSeg : null;
  }

  const contam = dias.filter((d) => d.contaNoBanco);
  const extrasSemanaMin = contam.reduce((s, d) => s + d.extraMin, 0);
  const trabalhadasMin = contam.reduce((s, d) => s + (d.trabalhadasMin ?? 0), 0);
  const bloqueios = dias.reduce((s, d) => s + d.pendencias.filter((p) => p.severidade === "bloqueia").length, 0);
  const avisos = dias.reduce((s, d) => s + d.pendencias.filter((p) => p.severidade === "aviso").length, 0);

  return {
    segunda: e.segunda,
    dias,
    trabalhadasMin,
    diasTrabalhados: contam.filter((d) => (d.trabalhadasMin ?? 0) > 0 && !d.ocorrencia).length,
    banco: resumoBanco(e.regras, e.saldoAnteriorMin, extrasSemanaMin, e.ajustesMin ?? 0),
    bloqueios,
    avisos,
    provisoria: bloqueios > 0,
  };
}
