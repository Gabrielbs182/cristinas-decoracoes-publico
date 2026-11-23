/** Leitura de recibos para telas, PDF e exportação (gestora e contador; o RLS filtra). */
import "server-only";

import type { DocumentoRecibo } from "@/lib/impressos/recibo";
import type { ClienteSupabase } from "@/lib/supabase/server";

import type { FormaPagamento, TipoRecibo } from "./recibos";

export interface ReciboDaLista {
  id: string;
  numero: number;
  tipo: TipoRecibo;
  orcamentoId: string | null;
  orcamentoNumero: number | null;
  pagador: string;
  referente: string;
  valorCentavos: number;
  forma: FormaPagamento;
  dataPagamento: string;
  status: "emitido" | "cancelado";
  motivoCancelamento: string;
  canceladoEm: string | null;
}

const CAMPOS = "id, numero, tipo, orcamento_id, orcamento_numero, pagador, referente, valor_centavos, forma, data_pagamento, status, motivo_cancelamento, cancelado_em";

function linha(r: {
  id: string;
  numero: number;
  tipo: TipoRecibo;
  orcamento_id: string | null;
  orcamento_numero: number | null;
  pagador: string;
  referente: string;
  valor_centavos: number;
  forma: FormaPagamento;
  data_pagamento: string;
  status: "emitido" | "cancelado";
  motivo_cancelamento: string;
  cancelado_em: string | null;
}): ReciboDaLista {
  return {
    id: r.id,
    numero: r.numero,
    tipo: r.tipo,
    orcamentoId: r.orcamento_id,
    orcamentoNumero: r.orcamento_numero,
    pagador: r.pagador,
    referente: r.referente,
    valorCentavos: r.valor_centavos,
    forma: r.forma,
    dataPagamento: r.data_pagamento,
    status: r.status,
    motivoCancelamento: r.motivo_cancelamento,
    canceladoEm: r.cancelado_em,
  };
}

/** Recibos de um mês ("2026-10") ou de todos os tempos ("todos"), do mais novo para o mais antigo. */
export async function carregarRecibos(supabase: ClienteSupabase, mes: string): Promise<ReciboDaLista[]> {
  let q = supabase.from("recibos").select(CAMPOS).order("numero", { ascending: false }).limit(2000);
  if (mes !== "todos") {
    const [a, m] = mes.split("-").map(Number);
    const fim = new Date(Date.UTC(a!, m!, 1)).toISOString().slice(0, 10);
    q = q.gte("data_pagamento", `${mes}-01`).lt("data_pagamento", fim);
  }
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao carregar os recibos: ${error.message}`);
  return (data ?? []).map(linha);
}

export async function carregarDocumentoRecibo(supabase: ClienteSupabase, id: string): Promise<(DocumentoRecibo & { id: string; orcamentoId: string | null; tipo: TipoRecibo }) | null> {
  const [{ data: r }, { data: e }] = await Promise.all([
    supabase.from("recibos").select(`${CAMPOS}`).eq("id", id).maybeSingle(),
    supabase.from("empresa").select("nome_fantasia, razao_social, cnpj, telefone, cidade_uf").maybeSingle(),
  ]);
  if (!r) return null;
  return {
    id: r.id,
    orcamentoId: r.orcamento_id,
    tipo: r.tipo,
    numero: r.numero,
    valor_centavos: r.valor_centavos,
    pagador: r.pagador,
    referente: r.referente,
    forma: r.forma,
    data_pagamento: r.data_pagamento,
    status: r.status,
    cancelado_em: r.cancelado_em,
    motivo_cancelamento: r.motivo_cancelamento,
    empresa: { nome: e?.nome_fantasia ?? "", razao_social: e?.razao_social ?? "", cnpj: e?.cnpj ?? "", telefone: e?.telefone ?? "", cidade_uf: e?.cidade_uf ?? "" },
  };
}

/** "2026-10" → "outubro de 2026" */
export function mesPorExtenso(mes: string): string {
  if (mes === "todos") return "todos os meses";
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Mês válido do parâmetro, ou o mês atual (em São Paulo). */
export function mesDoParametro(p: unknown): string {
  if (p === "todos") return "todos";
  if (typeof p === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return p;
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}
