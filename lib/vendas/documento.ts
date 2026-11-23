/** O orçamento como vai para a cliente (PDF e página do link). Vem pronto do banco (montar_documento_orcamento). */

export interface ItemDoDocumento {
  descricao: string;
  medidas: string;
  quantidade: number;
  unitario_centavos: number;
  total_centavos: number;
}

export interface DocumentoOrcamento {
  numero: number;
  status: "rascunho" | "enviado" | "aprovado" | "recusado" | "cancelado";
  vencido: boolean;
  criado_em: string;
  enviado_em: string | null;
  valido_ate: string | null;
  validade_dias: number;
  respondido_em: string | null;
  aprovado_pelo_link: boolean;
  cliente: { nome: string; telefone: string };
  endereco_obra: string;
  prazo_entrega: string;
  condicoes_pagamento: string;
  obs_cliente: string;
  subtotal_centavos: number;
  desconto_centavos: number;
  deslocamento_centavos: number;
  total_centavos: number;
  vendedora: string;
  empresa: { nome: string; razao_social: string; cnpj: string; telefone: string; email: string; endereco: string; cidade_uf: string } | null;
  ambientes: { nome: string; itens: ItemDoDocumento[] }[];
}

/** "2026-11-24" → "24/11/2026" */
export const dataBrIso = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

/** Data/hora do banco no fuso da loja. */
export const dataSP = (ts: string) => new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function textoValidade(d: Pick<DocumentoOrcamento, "valido_ate" | "validade_dias">): string {
  return d.valido_ate ? `Válido até ${dataBrIso(d.valido_ate)}` : `Validade de ${d.validade_dias} dias a partir do envio`;
}

export function nomeArquivoOrcamento(d: Pick<DocumentoOrcamento, "numero" | "cliente">): string {
  const cliente = d.cliente.nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/ /g, "-");
  return `Orcamento-${String(d.numero).padStart(4, "0")}-${cliente || "cliente"}.pdf`;
}
