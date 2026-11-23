import { avaliarDia, type BatidaCatraca, type Lancamento, REGRAS_PADRAO, type Regras } from "@/lib/ponto";

let proximoId = 1;

/** "07:01" ou "07:01:30" → segundos. */
export function seg(h: string): number {
  const [hh, mm, ss] = h.split(":").map(Number);
  return hh! * 3600 + mm! * 60 + (ss ?? 0);
}

/** Batidas da catraca; o código de tipo padrão segue a posição (0,1,2,3), como numa batida "certinha". */
export function batidas(horas: string[], iomd?: number[]): BatidaCatraca[] {
  return horas.map((h, i) => ({ id: proximoId++, horaSeg: seg(h), iomd: iomd?.[i] ?? Math.min(i, 3) }));
}

/** Omit que preserva cada variante da união (o Omit comum só manteria os campos comuns). */
type OmitirEmCada<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function lanc(l: OmitirEmCada<Lancamento, "id" | "motivo" | "criadoEm"> & { id?: number; motivo?: string }): Lancamento {
  return { id: l.id ?? proximoId++, motivo: l.motivo ?? "teste", criadoEm: "2026-02-09T10:00:00Z", ...l } as Lancamento;
}

export const QUINTA = "2026-02-05";
export const SEXTA = "2026-02-06";
export const SEGUNDA = "2026-02-02";
export const SABADO = "2026-02-07";

export function dia(
  data: string,
  horas: string[],
  opcoes: { iomd?: number[]; lancamentos?: Lancamento[]; regras?: Partial<Regras>; feriado?: string; bat?: BatidaCatraca[] } = {},
) {
  return avaliarDia({
    data,
    regras: { ...REGRAS_PADRAO, ...opcoes.regras },
    feriado: opcoes.feriado ?? null,
    batidas: opcoes.bat ?? batidas(horas, opcoes.iomd),
    lancamentos: opcoes.lancamentos ?? [],
  });
}

export const codigos = (r: ReturnType<typeof avaliarDia>) => r.pendencias.map((p) => p.codigo);
