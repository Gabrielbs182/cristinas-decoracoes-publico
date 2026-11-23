/**
 * Dinheiro em centavos e medidas em centímetros (inteiros), como no banco. A tela fala em reais e metros
 * no formato brasileiro ("1.450,00", "3,20").
 */

const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 8990 → "R$ 89,90" */
export function brl(centavos: number): string {
  return REAIS.format(centavos / 100).replace(/ /g, " ");
}

/** 8990 → "89,90" (para campo de edição). */
export function reaisParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Texto digitado → centavos. Aceita "89,90", "R$ 1.450,00", "1450", "89.90" e "1.450" (milhar).
 * Mais de 2 casas decimais ou texto inválido → null.
 */
export function centavosDeTexto(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [inteiro, decimais = ""] = t.split(".");
  return Number(inteiro) * 100 + Number(decimais.padEnd(2, "0"));
}

/** 320 → "3,20 m" */
export function metros(cm: number): string {
  return `${(cm / 100).toFixed(2).replace(".", ",")} m`;
}

/** 15000 → "1,50 m²" */
export function metrosQuadrados(cm2: number): string {
  return `${(cm2 / 10000).toFixed(2).replace(".", ",")} m²`;
}

/** "3,20" ou "3.2" (metros) → 320 cm. Até 2 casas (centímetro). */
export function cmDeMetros(texto: string): number | null {
  const t = texto.replace(/\s|m$/gi, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [inteiro, decimais = ""] = t.split(".");
  return Number(inteiro) * 100 + Number(decimais.padEnd(2, "0"));
}

/** "1,50" (m²) → 15000 cm². */
export function cm2DeMetrosQuadrados(texto: string): number | null {
  const t = texto.replace(/\s|m²$|m2$/gi, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [inteiro, decimais = ""] = t.split(".");
  return Number(inteiro) * 10000 + Number(decimais.padEnd(2, "0")) * 100;
}

/** Fator 2.5 → "2,5"; 2 → "2,0" */
export function fator(f: number): string {
  return f.toFixed(f * 10 === Math.round(f * 10) ? 1 : 2).replace(".", ",");
}

/** "2,5" → 2.5 (1,00 a 4,00). */
export function fatorDeTexto(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!/^\d(\.\d{1,2})?$/.test(t)) return null;
  const f = Number(t);
  return f >= 1 && f <= 4 ? f : null;
}

/** CPF/CNPJ: só os dígitos; formata para leitura. */
export function documentoFormatado(digitos: string): string {
  if (digitos.length === 11) return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digitos.length === 14) return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return digitos;
}

/** Telefone brasileiro → link do WhatsApp (55 + DDD + número). Sem DDD válido → null. */
export function whatsappDoTelefone(telefone: string): string | null {
  let d = telefone.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return `https://wa.me/55${d}`;
}
