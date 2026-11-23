/** Regras de jornada (espelham a tabela regras_ponto). Defaults = comportamento do script legado. */

export interface Regras {
  cargaSegQuiMin: number;
  cargaSexMin: number;
  entradaPrevistaMin: number;
  almocoInicioPrevistoMin: number;
  almocoPadraoMin: number;
  horaCorteMin: number;
  toleranciaCorteMin: number;
  toleranciaAtrasoMin: number;
  janelaDuplicadaMin: number;
}

export const REGRAS_PADRAO: Regras = {
  cargaSegQuiMin: 540,
  cargaSexMin: 480,
  entradaPrevistaMin: 7 * 60,
  almocoInicioPrevistoMin: 12 * 60,
  almocoPadraoMin: 60,
  horaCorteMin: 480,
  toleranciaCorteMin: 10,
  toleranciaAtrasoMin: 10,
  janelaDuplicadaMin: 5,
};

/** Jornada própria da funcionária (nulo = usa a regra geral). */
export interface Jornada {
  cargaSegQuiMin?: number | null;
  cargaSexMin?: number | null;
}

/** Carga prevista para um dia útil, sem considerar feriado. Sábado e domingo = 0. */
export function cargaDoDiaUtil(regras: Regras, dow: number, jornada?: Jornada): number {
  if (dow >= 6) return 0;
  if (dow === 5) return jornada?.cargaSexMin ?? regras.cargaSexMin;
  return jornada?.cargaSegQuiMin ?? regras.cargaSegQuiMin;
}
