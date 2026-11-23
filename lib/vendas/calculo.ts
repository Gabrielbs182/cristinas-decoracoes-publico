/**
 * Regras de cálculo do orçamento (puras, inteiros). O editor de orçamentos usa estas mesmas funções e
 * mostra a memória de cálculo; o catálogo mostra a regra com os números configurados.
 */
import { brl, fator, metros, metrosQuadrados } from "./numeros";

export type Categoria = "tecido" | "persiana" | "trilho" | "acessorio" | "servico";
export type Unidade = "m" | "m2" | "un" | "vao";

export const CATEGORIAS: { categoria: Categoria; rotulo: string; unidade: Unidade }[] = [
  { categoria: "tecido", rotulo: "Tecidos", unidade: "m" },
  { categoria: "persiana", rotulo: "Persianas", unidade: "m2" },
  { categoria: "trilho", rotulo: "Trilhos e varões", unidade: "m" },
  { categoria: "acessorio", rotulo: "Acessórios", unidade: "un" },
  { categoria: "servico", rotulo: "Serviços", unidade: "vao" },
];

export const ROTULO_UNIDADE: Record<Unidade, string> = { m: "metro", m2: "m²", un: "unidade", vao: "vão" };

export interface RegrasOrcamento {
  sobraTrilhoCm: number;
  areaMinimaPersianaCm2: number;
}

export interface ModeloConfeccao {
  nome: string;
  fatorFranzimento: number;
  precoMetroCentavos: number;
}

/** Metros de tecido (em cm) = largura do vão × fator de franzimento, arredondado para cima no centímetro. */
export function tecidoCm(larguraVaoCm: number, fatorFranzimento: number): number {
  return Math.ceil(Math.round(larguraVaoCm * fatorFranzimento * 100) / 100);
}

/** Área da persiana, com a mínima cobrada quando o vão é pequeno. */
export function areaPersiana(larguraCm: number, alturaCm: number, minimaCm2: number): { areaCm2: number; cobradaCm2: number; minimaAplicada: boolean } {
  const areaCm2 = larguraCm * alturaCm;
  return { areaCm2, cobradaCm2: Math.max(areaCm2, minimaCm2), minimaAplicada: areaCm2 < minimaCm2 };
}

/** Trilho = largura do vão + sobra. */
export function trilhoCm(larguraVaoCm: number, sobraCm: number): number {
  return larguraVaoCm + sobraCm;
}

/** Valor em centavos de uma quantidade (cm para metro, cm² para m², inteiro para unidade/vão). Arredonda no centavo. */
export function valorCentavos(quantidade: number, unidade: Unidade, precoCentavos: number): number {
  if (unidade === "m") return Math.round((quantidade * precoCentavos) / 100);
  if (unidade === "m2") return Math.round((quantidade * precoCentavos) / 10000);
  return quantidade * precoCentavos;
}

/** A regra de cada categoria em uma frase, com os números configurados (topo do catálogo). */
export function regraDaCategoria(categoria: Categoria, regras: RegrasOrcamento, modelos: ModeloConfeccao[]): string {
  switch (categoria) {
    case "tecido": {
      const fatores = modelos.length ? ` (${modelos.map((m) => `${m.nome.toLowerCase()} ${fator(m.fatorFranzimento)}`).join(" · ")})` : "";
      return `Largura do vão × fator de franzimento${fatores} = metros de tecido × preço por metro. A confecção é cobrada por metro de tecido, conforme o modelo.`;
    }
    case "persiana":
      return `Largura × altura = m², com área mínima cobrada de ${metrosQuadrados(regras.areaMinimaPersianaCm2)} × preço por m².`;
    case "trilho":
      return `(Largura do vão + ${metros(regras.sobraTrilhoCm).replace(" m", "")} m de sobra) × preço por metro.`;
    case "acessorio":
      return "Preço por unidade.";
    case "servico":
      return "Preço por vão ou por serviço.";
  }
}

/** Exemplo da regra do tecido para o modelo (texto da memória de cálculo). */
export function exemploTecido(larguraVaoCm: number, modelo: ModeloConfeccao, precoTecidoCentavos: number): string {
  const t = tecidoCm(larguraVaoCm, modelo.fatorFranzimento);
  const tecido = valorCentavos(t, "m", precoTecidoCentavos);
  const confeccao = valorCentavos(t, "m", modelo.precoMetroCentavos);
  return `${metros(larguraVaoCm)} × ${fator(modelo.fatorFranzimento)} = ${metros(t)} de tecido → tecido ${brl(tecido)} + confecção ${brl(confeccao)}`;
}
