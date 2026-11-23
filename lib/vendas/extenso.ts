/**
 * Valor por extenso em reais (recibo). Regras do português do Brasil:
 * - "cem" sozinho, "cento e…" com resto; "mil" sem "um"; "um milhão" / "dois milhões";
 * - entre grupos (milhão, mil, unidades) entra "e" quando o grupo seguinte é o último e é menor que cem ou
 *   centena redonda ("mil e duzentos", "mil duzentos e trinta e quatro");
 * - "de reais" depois de milhão redondo ("um milhão de reais"); singular "um real", "um centavo".
 */

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0 a 999 por extenso ("" para zero). */
function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]!);
  if (resto) {
    if (resto < 10) partes.push(UNIDADES[resto]!);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]!);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]!);
    }
  }
  return partes.join(" e ");
}

/** Inteiro (0 a 999.999.999) por extenso. */
function inteiro(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const unidades = n % 1000;
  const grupos: { texto: string; valor: number }[] = [];
  if (milhoes) grupos.push({ texto: `${ate999(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`, valor: milhoes });
  if (milhares) grupos.push({ texto: milhares === 1 ? "mil" : `${ate999(milhares)} mil`, valor: milhares });
  if (unidades) grupos.push({ texto: ate999(unidades), valor: unidades });

  let texto = grupos[0]!.texto;
  for (let i = 1; i < grupos.length; i++) {
    const g = grupos[i]!;
    const ultimo = i === grupos.length - 1;
    texto += ultimo && (g.valor < 100 || g.valor % 100 === 0) ? ` e ${g.texto}` : ` ${g.texto}`;
  }
  return texto;
}

export function valorPorExtenso(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos < 0 || centavos >= 100_000_000_000) throw new Error("Valor fora do intervalo do recibo.");
  const reais = Math.floor(centavos / 100);
  const cents = centavos % 100;
  const partes: string[] = [];
  if (reais) {
    const milhaoRedondo = reais >= 1_000_000 && reais % 1_000_000 === 0;
    partes.push(`${inteiro(reais)} ${milhaoRedondo ? "de reais" : reais === 1 ? "real" : "reais"}`);
  }
  if (cents) partes.push(`${ate999(cents)} ${cents === 1 ? "centavo" : "centavos"}`);
  return partes.length ? partes.join(" e ") : "zero real";
}
