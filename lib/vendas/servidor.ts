/** Leitura de catálogo e orçamento para as telas (com a sessão da gestora; o RLS filtra). */
import "server-only";

import type { ClienteSupabase } from "@/lib/supabase/server";

import type { Unidade } from "./calculo";
import { type Catalogo, chaveDePreco, type EntradaItem, type Precos, situacaoDoOrcamento, type StatusOrcamento, type TipoItem } from "./orcamento";

export const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Catálogo inteiro (inclusive inativos: item antigo pode apontar para eles). As telas oferecem só os ativos. */
export async function carregarCatalogo(supabase: ClienteSupabase): Promise<Catalogo> {
  const [{ data: produtos, error: e1 }, { data: modelos, error: e2 }, { data: regras, error: e3 }] = await Promise.all([
    supabase.from("produtos").select("id, categoria, nome, unidade, preco_centavos, largura_rolo_cm, ativo").order("nome"),
    supabase.from("modelos_confeccao").select("id, nome, fator_franzimento, preco_metro_centavos, ativo").order("nome"),
    supabase.from("regras_orcamento").select("sobra_trilho_cm, area_minima_persiana_cm2").maybeSingle(),
  ]);
  const erro = e1 ?? e2 ?? e3;
  if (erro) throw new Error(`Falha ao carregar o catálogo: ${erro.message}`);
  return {
    produtos: (produtos ?? []).map((p) => ({
      id: p.id,
      categoria: p.categoria,
      nome: p.nome,
      unidade: p.unidade as Unidade,
      precoCentavos: p.preco_centavos,
      larguraRoloCm: p.largura_rolo_cm,
      ativo: p.ativo,
    })),
    modelos: (modelos ?? []).map((m) => ({ id: m.id, nome: m.nome, fatorFranzimento: Number(m.fator_franzimento), precoMetroCentavos: m.preco_metro_centavos, ativo: m.ativo })),
    sobraTrilhoCm: regras?.sobra_trilho_cm ?? 20,
    areaMinimaPersianaCm2: regras?.area_minima_persiana_cm2 ?? 15000,
  };
}

export interface AmbienteEditavel {
  id: string;
  nome: string;
  itens: EntradaItem[];
}

export interface OrcamentoEditavel {
  id: string;
  numero: number;
  status: StatusOrcamento;
  situacao: StatusOrcamento | "vencido";
  clienteId: string;
  enderecoObra: string;
  validadeDias: number;
  prazoEntrega: string;
  condicoes: string;
  desconto: { modo: "pct" | "brl"; valor: number };
  deslocamentoCentavos: number;
  obsCliente: string;
  obsInterna: string;
  token: string;
  criadoEm: string;
  enviadoEm: string | null;
  validoAte: string | null;
  respondidoEm: string | null;
  respostaMotivo: string;
  aprovadoPeloLink: boolean;
  totalCentavos: number;
  vendedora: string;
  ambientes: AmbienteEditavel[];
  /** Preços congelados por item (id → chave e preços da época). */
  congelados: Record<string, { chave: string; precos: Precos }>;
}

export async function carregarOrcamento(supabase: ClienteSupabase, id: string): Promise<OrcamentoEditavel | null> {
  const [{ data: o }, { data: ambientes }, { data: itens }] = await Promise.all([
    supabase.from("orcamentos").select("*").eq("id", id).maybeSingle(),
    supabase.from("orcamento_ambientes").select("id, nome, ordem").eq("orcamento_id", id).order("ordem"),
    supabase.from("orcamento_itens").select("*").eq("orcamento_id", id).order("ordem"),
  ]);
  if (!o) return null;
  const { data: autor } = o.criado_por ? await supabase.from("perfis").select("nome").eq("id", o.criado_por).maybeSingle() : { data: null };

  const congelados: OrcamentoEditavel["congelados"] = {};
  const entrada = (i: NonNullable<typeof itens>[number]): EntradaItem => {
    const e: EntradaItem = {
      id: i.id,
      tipo: i.tipo as TipoItem,
      produtoId: i.produto_id,
      modeloId: i.modelo_id,
      trilhoId: i.trilho_id,
      motorizado: i.motorizado,
      motorId: i.motor_id,
      instalacaoId: i.instalacao_id,
      cor: i.cor,
      larguraCm: i.largura_cm,
      alturaCm: i.altura_cm,
      quantidade: i.quantidade,
    };
    congelados[i.id] = { chave: chaveDePreco(e), precos: i.precos as unknown as Precos };
    return e;
  };

  return {
    id: o.id,
    numero: o.numero,
    status: o.status,
    situacao: situacaoDoOrcamento(o.status, o.valido_ate, hojeSP()),
    clienteId: o.cliente_id,
    enderecoObra: o.endereco_obra,
    validadeDias: o.validade_dias,
    prazoEntrega: o.prazo_entrega,
    condicoes: o.condicoes_pagamento,
    desconto: { modo: o.desconto_modo as "pct" | "brl", valor: o.desconto_valor },
    deslocamentoCentavos: o.deslocamento_centavos,
    obsCliente: o.obs_cliente,
    obsInterna: o.obs_interna,
    token: o.token,
    criadoEm: o.criado_em,
    enviadoEm: o.enviado_em,
    validoAte: o.valido_ate,
    respondidoEm: o.respondido_em,
    respostaMotivo: o.resposta_motivo,
    aprovadoPeloLink: o.aprovado_pelo_link,
    totalCentavos: o.total_centavos,
    vendedora: autor?.nome ?? "",
    ambientes: (ambientes ?? []).map((a) => ({ id: a.id, nome: a.nome, itens: (itens ?? []).filter((i) => i.ambiente_id === a.id).map(entrada) })),
    congelados,
  };
}

/** Endereços que a ficha do cliente oferece para a obra. */
export function enderecosDoCliente(c: {
  residencia_endereco: string;
  residencia_bairro: string;
  residencia_cidade: string;
  obra_endereco: string;
  obra_bairro: string;
  obra_cidade: string;
}): { rotulo: string; endereco: string }[] {
  const junta = (rua: string, bairro: string, cidade: string) => [rua, [bairro, cidade].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
  const out: { rotulo: string; endereco: string }[] = [];
  if (c.obra_endereco) out.push({ rotulo: "Obra", endereco: junta(c.obra_endereco, c.obra_bairro, c.obra_cidade) });
  if (c.residencia_endereco) out.push({ rotulo: "Residência", endereco: junta(c.residencia_endereco, c.residencia_bairro, c.residencia_cidade) });
  return out;
}
