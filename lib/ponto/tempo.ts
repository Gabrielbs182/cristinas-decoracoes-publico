/** Utilidades de data e hora do ponto. Datas trafegam como 'YYYY-MM-DD'; horas como segundos/minutos desde 00:00. */

const DIA_MS = 86_400_000;

function paraUtc(data: string): Date {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!));
}

function deUtc(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** 1 = segunda … 7 = domingo (ISO). */
export function isoDow(data: string): number {
  const d = paraUtc(data).getUTCDay();
  return d === 0 ? 7 : d;
}

export function somarDias(data: string, dias: number): string {
  return deUtc(new Date(paraUtc(data).getTime() + dias * DIA_MS));
}

export function segundaDe(data: string): string {
  return somarDias(data, 1 - isoDow(data));
}

export function diasDaSemana(segunda: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** 25260 → "07:01" (segundos são descartados na exibição, como no legado). */
export function horaDeSeg(seg: number): string {
  const min = Math.floor(seg / 60);
  return `${p2(Math.floor(min / 60))}:${p2(min % 60)}`;
}

/** 537 → "08:57"; -90 → "-01:30". Formato das tabelas. */
export function hhmm(min: number): string {
  const s = min < 0 ? "-" : "";
  const a = Math.abs(min);
  return `${s}${p2(Math.floor(a / 60))}:${p2(a % 60)}`;
}

/** 537 → "8h57"; -3 → "−0h03". Formato de texto corrido. */
export function duracao(min: number): string {
  const s = min < 0 ? "−" : "";
  const a = Math.abs(min);
  return `${s}${Math.floor(a / 60)}h${p2(a % 60)}`;
}

/** "07:05" → 425 minutos; inválido → null. */
export function minDeHhmm(txt: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(txt.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "2026-02-02" → "02/02/2026". */
export function dataBr(data: string): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

/** "2026-02-02" → "02/02". */
export function diaMes(data: string): string {
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

export const NOME_DIA = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"] as const;
export const SIGLA_DIA = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
