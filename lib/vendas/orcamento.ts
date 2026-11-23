/**
 * Motor do orçamento (puro): calcula cada item a partir das medidas e dos preços CONGELADOS no item, e os
 * totais. Roda igual no navegador (prévia ao vivo) e no servidor (que recalcula antes de gravar).
 *
 * Preço congelado: o item guarda os preços do catálogo do momento em que o produto foi escolhido. Mudar
 * só medida, cor ou quantidade não reprecifica; trocar o produto (a "chave de preço") pega o preço atual.
 */
import { areaPersiana, tecidoCm, trilhoCm, valorCentavos, type Unidade } from "./calculo";
import { brl, fator, metros, metrosQuadrados } from "./numeros";

export type TipoItem = "cortina" | "persiana" | "trilho" | "acessorio" | "servico";

export const TIPOS_ITEM: { tipo: TipoItem; rotulo: string }[] = [
  { tipo: "cortina", rotulo: "Cortina de tecido" },
  { tipo: "persiana", rotulo: "Persiana" },
  { tipo: "trilho", rotulo: "Trilho / varão" },
  { tipo: "acessorio", rotulo: "Acessório" },
  { tipo: "servico", rotulo: "Serviço" },
];

/** O que a gestora escolhe e mede. */
export interface EntradaItem {
  id: string;
  tipo: TipoItem;
  produtoId: string | null; // tecido, persiana, trilho, acessório ou serviço
  modeloId: string | null; // cortina: modelo de confecção
  trilhoId: string | null; // cortina: null = sem trilho
  motorizado: boolean;
  motorId: string | null; // cortina/persiana motorizada
  instalacaoId: string | null; // cortina/persiana: null = sem instalação
  cor: string;
  larguraCm: number | null;
  alturaCm: number | null;
  quantidade: number;
}

export interface ProdutoDoCatalogo {
  id: string;
  categoria: "tecido" | "persiana" | "trilho" | "acessorio" | "servico";
  nome: string;
  unidade: Unidade;
  precoCentavos: number;
  larguraRoloCm: number | null;
  ativo: boolean;
}

export interface ModeloDoCatalogo {
  id: string;
  nome: string;
  fatorFranzimento: number;
  precoMetroCentavos: number;
  ativo: boolean;
}

export interface Catalogo {
  produtos: ProdutoDoCatalogo[];
  modelos: ModeloDoCatalogo[];
  sobraTrilhoCm: number;
  areaMinimaPersianaCm2: number;
}

interface PrecoCongelado {
  nome: string;
  precoCentavos: number;
  unidade: Unidade;
  larguraRoloCm?: number | null;
}

/** Preços e regras congelados no item (vão para a coluna `precos`). */
export interface Precos {
  produto: PrecoCongelado | null;
  modelo: { nome: string; fatorFranzimento: number; precoMetroCentavos: number } | null;
  trilho: PrecoCongelado | null;
  motor: PrecoCongelado | null;
  instalacao: PrecoCongelado | null;
  sobraTrilhoCm: number;
  areaMinimaPersianaCm2: number;
}

export interface Linha {
  rotulo: string;
  memoria: string;
  valorCentavos: number;
}

export interface ItemCalculado {
  linhas: Linha[];
  unitarioCentavos: number;
  totalCentavos: number;
  descricao: string;
  medidas: string;
  /** O que falta para o item valer (vazio = completo). */
  faltando: string[];
  avisos: string[];
}

/** Muda quando muda o que define o preço (produto, modelo, trilho, motor, instalação). */
export function chaveDePreco(i: EntradaItem): string {
  const motor = i.motorizado ? i.motorId : null;
  return [i.tipo, i.produtoId, i.modeloId, i.trilhoId, motor, i.instalacaoId].map((x) => x ?? "-").join("|");
}

const congelar = (p: ProdutoDoCatalogo | undefined): PrecoCongelado | null =>
  p ? { nome: p.nome, precoCentavos: p.precoCentavos, unidade: p.unidade, larguraRoloCm: p.larguraRoloCm } : null;

/** Preços atuais do catálogo para o que o item escolheu. */
export function precosDoCatalogo(i: EntradaItem, c: Catalogo): Precos {
  const produto = (id: string | null) => (id ? c.produtos.find((p) => p.id === id) : undefined);
  const modelo = i.tipo === "cortina" && i.modeloId ? c.modelos.find((m) => m.id === i.modeloId) : undefined;
  const comAcionamento = i.tipo === "cortina" || i.tipo === "persiana";
  return {
    produto: congelar(produto(i.produtoId)),
    modelo: modelo ? { nome: modelo.nome, fatorFranzimento: modelo.fatorFranzimento, precoMetroCentavos: modelo.precoMetroCentavos } : null,
    trilho: i.tipo === "cortina" ? congelar(produto(i.trilhoId)) : null,
    motor: comAcionamento && i.motorizado ? congelar(produto(i.motorId)) : null,
    instalacao: comAcionamento ? congelar(produto(i.instalacaoId)) : null,
    sobraTrilhoCm: c.sobraTrilhoCm,
    areaMinimaPersianaCm2: c.areaMinimaPersianaCm2,
  };
}

/** Preço congelado se o produto não mudou; senão, o do catálogo agora. */
export function precosDoItem(i: EntradaItem, c: Catalogo, congelado?: { chave: string; precos: Precos }): Precos {
  return congelado && congelado.chave === chaveDePreco(i) ? congelado.precos : precosDoCatalogo(i, c);
}

const qtd = (n: number) => (n === 1 ? "1 un" : `${n} un`);

function linhaUnidade(rotulo: string, p: PrecoCongelado): Linha {
  const un = p.unidade === "vao" ? "vão" : "un";
  return { rotulo, memoria: `1 ${un} × ${brl(p.precoCentavos)} (${p.nome.toLowerCase()})`, valorCentavos: p.precoCentavos };
}

export function calcularItem(i: EntradaItem, p: Precos): ItemCalculado {
  const linhas: Linha[] = [];
  const faltando: string[] = [];
  const avisos: string[] = [];
  const L = i.larguraCm;
  const A = i.alturaCm;
  const cor = i.cor.trim();
  let descricao = "";
  let medidas = "";

  switch (i.tipo) {
    case "cortina": {
      if (!p.produto) faltando.push("tecido");
      if (!p.modelo) faltando.push("modelo de confecção");
      if (!L) faltando.push("largura");
      if (i.motorizado && !p.motor) faltando.push("motor");
      descricao = ["Cortina", p.modelo?.nome.toLowerCase(), p.produto?.nome, cor, i.motorizado ? "motorizada" : null].filter(Boolean).join(" · ");
      medidas = L ? (A ? `${metros(L).replace(" m", "")} × ${metros(A)}` : metros(L)) : "";
      if (L && p.produto && p.modelo) {
        const t = tecidoCm(L, p.modelo.fatorFranzimento);
        linhas.push({
          rotulo: "Tecido",
          memoria: `${metros(L)} × ${fator(p.modelo.fatorFranzimento)} = ${metros(t)} × ${brl(p.produto.precoCentavos)}`,
          valorCentavos: valorCentavos(t, "m", p.produto.precoCentavos),
        });
        linhas.push({
          rotulo: "Confecção",
          memoria: `${metros(t)} de tecido × ${brl(p.modelo.precoMetroCentavos)} (${p.modelo.nome.toLowerCase()})`,
          valorCentavos: valorCentavos(t, "m", p.modelo.precoMetroCentavos),
        });
        if (A && p.produto.larguraRoloCm && A > p.produto.larguraRoloCm) {
          avisos.push(`Altura de ${metros(A)} maior que a largura do rolo (${metros(p.produto.larguraRoloCm)}): confira a emenda.`);
        }
      }
      if (L && p.trilho) {
        const tr = trilhoCm(L, p.sobraTrilhoCm);
        linhas.push({
          rotulo: "Trilho",
          memoria: `(${metros(L)} + ${metros(p.sobraTrilhoCm)} de sobra) = ${metros(tr)} × ${brl(p.trilho.precoCentavos)} (${p.trilho.nome.toLowerCase()})`,
          valorCentavos: valorCentavos(tr, "m", p.trilho.precoCentavos),
        });
      }
      break;
    }
    case "persiana": {
      if (!p.produto) faltando.push("modelo da persiana");
      if (!L) faltando.push("largura");
      if (!A) faltando.push("altura");
      if (i.motorizado && !p.motor) faltando.push("motor");
      descricao = ["Persiana", p.produto?.nome.toLowerCase(), cor, i.motorizado ? "motorizada" : null].filter(Boolean).join(" · ");
      medidas = L && A ? `${metros(L).replace(" m", "")} × ${metros(A)}` : "";
      if (L && A && p.produto) {
        const a = areaPersiana(L, A, p.areaMinimaPersianaCm2);
        const minima = a.minimaAplicada ? ` → mínimo ${metrosQuadrados(p.areaMinimaPersianaCm2)}` : "";
        linhas.push({
          rotulo: "Persiana",
          memoria: `${metros(L)} × ${metros(A)} = ${metrosQuadrados(a.areaCm2)}${minima} × ${brl(p.produto.precoCentavos)}`,
          valorCentavos: valorCentavos(a.cobradaCm2, "m2", p.produto.precoCentavos),
        });
      }
      break;
    }
    case "trilho": {
      if (!p.produto) faltando.push("trilho");
      if (!L) faltando.push("largura");
      descricao = [p.produto?.nome ?? "Trilho", cor].filter(Boolean).join(" · ");
      medidas = L ? metros(L) : "";
      if (L && p.produto) {
        const tr = trilhoCm(L, p.sobraTrilhoCm);
        linhas.push({
          rotulo: "Trilho",
          memoria: `(${metros(L)} + ${metros(p.sobraTrilhoCm)}) = ${metros(tr)} × ${brl(p.produto.precoCentavos)}`,
          valorCentavos: valorCentavos(tr, "m", p.produto.precoCentavos),
        });
      }
      break;
    }
    case "acessorio":
    case "servico": {
      if (!p.produto) faltando.push(i.tipo === "servico" ? "serviço" : "acessório");
      descricao = [p.produto?.nome ?? (i.tipo === "servico" ? "Serviço" : "Acessório"), cor].filter(Boolean).join(" · ");
      if (p.produto) linhas.push(linhaUnidade(i.tipo === "servico" ? "Serviço" : "Acessório", p.produto));
      break;
    }
  }

  if ((i.tipo === "cortina" || i.tipo === "persiana") && !faltando.length) {
    if (i.motorizado && p.motor) linhas.push(linhaUnidade("Motor", p.motor));
    if (p.instalacao) linhas.push(linhaUnidade("Instalação", p.instalacao));
  }

  const quantidade = Math.max(1, Math.trunc(i.quantidade || 1));
  const unitarioCentavos = faltando.length ? 0 : linhas.reduce((t, l) => t + l.valorCentavos, 0);
  return { linhas: faltando.length ? [] : linhas, unitarioCentavos, totalCentavos: unitarioCentavos * quantidade, descricao, medidas, faltando, avisos };
}

/** Texto da quantidade na memória ("R$ 1.234,00 × 2 un"). */
export function memoriaQuantidade(c: ItemCalculado, quantidade: number): string {
  return quantidade > 1 ? `${brl(c.unitarioCentavos)} × ${qtd(quantidade)}` : "1 un";
}

export interface Desconto {
  modo: "pct" | "brl";
  /** pct: centésimos de ponto percentual (500 = 5%); brl: centavos. */
  valor: number;
}

export function calcularTotais(totaisDosItens: number[], desconto: Desconto, deslocamentoCentavos: number) {
  const subtotal = totaisDosItens.reduce((t, v) => t + v, 0);
  const descontoCentavos = Math.min(subtotal, desconto.modo === "pct" ? Math.round((subtotal * desconto.valor) / 10000) : desconto.valor);
  return { subtotal, desconto: descontoCentavos, total: subtotal - descontoCentavos + deslocamentoCentavos };
}

/** "5,5" → 550 (centésimos de ponto percentual), até 100%. */
export function percentualDeTexto(texto: string): number | null {
  const t = texto.trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const [inteiro, decimais = ""] = t.split(".");
  const v = Number(inteiro) * 100 + Number(decimais.padEnd(2, "0"));
  return v <= 10000 ? v : null;
}

export function percentual(centesimos: number): string {
  return `${(centesimos / 100).toFixed(centesimos % 100 ? 2 : 0).replace(".", ",")}%`;
}

/** Item novo com escolhas razoáveis do catálogo ativo (primeiro de cada tipo; motor e instalação pelo nome). */
export function itemNovo(id: string, tipo: TipoItem, c: Catalogo): EntradaItem {
  const ativos = (cat: ProdutoDoCatalogo["categoria"]) => c.produtos.filter((p) => p.ativo && p.categoria === cat);
  const porNome = (lista: ProdutoDoCatalogo[], trecho: RegExp) => lista.find((p) => trecho.test(p.nome)) ?? null;
  const categoria = tipo === "cortina" ? "tecido" : tipo;
  const trilhos = ativos("trilho");
  return {
    id,
    tipo,
    produtoId: ativos(categoria)[0]?.id ?? null,
    modeloId: tipo === "cortina" ? (c.modelos.find((m) => m.ativo)?.id ?? null) : null,
    trilhoId: tipo === "cortina" ? ((trilhos.find((t) => !/motor/i.test(t.nome)) ?? trilhos[0])?.id ?? null) : null,
    motorizado: false,
    motorId: porNome(ativos("acessorio"), /motor/i)?.id ?? null,
    instalacaoId: tipo === "cortina" || tipo === "persiana" ? (porNome(ativos("servico"), /instala/i)?.id ?? null) : null,
    cor: "",
    larguraCm: null,
    alturaCm: null,
    quantidade: 1,
  };
}

export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado" | "cancelado";

/** "Vencido" não é gravado: é enviado com a validade no passado. */
export function situacaoDoOrcamento(status: StatusOrcamento, validoAte: string | null, hoje: string): StatusOrcamento | "vencido" {
  return status === "enviado" && validoAte && validoAte < hoje ? "vencido" : status;
}

export const ROTULO_SITUACAO: Record<StatusOrcamento | "vencido", string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

/** 118 → "0118" */
export const numeroOrcamento = (n: number) => String(n).padStart(4, "0");
