/** Leitura segura dos parâmetros de URL das telas do ponto. */
import { segundaDe } from "./tempo";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function segundaDoParametro(s: string | string[] | undefined): string | null {
  return typeof s === "string" && DATA.test(s) && !Number.isNaN(Date.parse(s)) ? segundaDe(s) : null;
}

/** "?d=<funcionariaId>_<data>" abre o detalhe do dia. */
export function diaDoParametro(d: string | string[] | undefined): { funcionariaId: string; data: string } | null {
  if (typeof d !== "string") return null;
  const [funcionariaId, data] = d.split("_");
  return funcionariaId && data && DATA.test(data) ? { funcionariaId, data } : null;
}
