/** Recibos: rótulos, texto do "referente a" e valor sugerido por tipo (puro). */

export type TipoRecibo = "sinal" | "parcela" | "quitacao" | "avulso";
export type FormaPagamento = "pix" | "dinheiro" | "cartao_credito" | "cartao_debito" | "transferencia";

export const FORMAS: { forma: FormaPagamento; rotulo: string }[] = [
  { forma: "pix", rotulo: "PIX" },
  { forma: "dinheiro", rotulo: "Dinheiro" },
  { forma: "cartao_credito", rotulo: "Cartão de crédito" },
  { forma: "cartao_debito", rotulo: "Cartão de débito" },
  { forma: "transferencia", rotulo: "Transferência" },
];
export const ROTULO_FORMA = Object.fromEntries(FORMAS.map((f) => [f.forma, f.rotulo])) as Record<FormaPagamento, string>;

export const ROTULO_TIPO: Record<TipoRecibo, string> = { sinal: "Sinal", parcela: "Parcela", quitacao: "Quitação", avulso: "Avulso" };

const ARTIGO: Record<Exclude<TipoRecibo, "avulso">, string> = { sinal: "ao sinal", parcela: "à parcela", quitacao: "à quitação" };

/** "Sala", "Quarto", "Escritório" → "Sala, Quarto e Escritório" */
export function listaHumana(nomes: string[]): string {
  const n = nomes.filter(Boolean);
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} e ${n.at(-1)}`;
}

/**
 * O que vem depois de "referente" no recibo, já com a preposição:
 * orçamento → "ao sinal do orçamento nº 0118 (Sala e Escritório)"; avulso → "a conserto de varão".
 */
export function textoReferente(tipo: TipoRecibo, d: { orcamentoNumero?: number | null; ambientes?: string[]; avulso?: string }): string {
  if (tipo === "avulso") {
    const t = (d.avulso ?? "").trim();
    return /^(a|ao|aos|à|às)\s/i.test(t) ? t : `a ${t}`;
  }
  const amb = listaHumana(d.ambientes ?? []);
  return `${ARTIGO[tipo]} do orçamento nº ${String(d.orcamentoNumero ?? 0).padStart(4, "0")}${amb ? ` (${amb})` : ""}`;
}

/** Valor que o formulário sugere: sinal = metade do total (até o saldo); quitação = o saldo; parcela = nada. */
export function valorSugerido(tipo: TipoRecibo, totalCentavos: number, saldoCentavos: number): number | null {
  if (tipo === "quitacao") return saldoCentavos;
  if (tipo === "sinal") return Math.min(saldoCentavos, Math.round(totalCentavos / 2));
  return null;
}

/** "Campinas/SP" → "Campinas" (para "Campinas, 9 de fevereiro de 2026."). */
export function cidadeDoRecibo(cidadeUf: string): string {
  return cidadeUf.split(/[/-]/)[0]!.trim();
}

/** "2026-02-09" → "9 de fevereiro de 2026" */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!)).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export const numeroRecibo = (n: number) => String(n).padStart(4, "0");
