"use server";

/**
 * Orçamentos (só a gestora). O rascunho é salvo inteiro de uma vez: o servidor recalcula cada item com o
 * motor (lib/vendas/orcamento.ts) — preço congelado quando o produto não mudou, preço atual quando mudou —
 * e grava tudo junto pela RPC salvar_orcamento. Situação muda por UPDATE; o banco valida a transição.
 */
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { exigirPapel } from "@/lib/auth";
import { calcularItem, calcularTotais, type Catalogo, chaveDePreco, type EntradaItem, numeroOrcamento, type Precos, precosDoItem } from "@/lib/vendas/orcamento";
import { carregarCatalogo, enderecosDoCliente } from "@/lib/vendas/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

function falhou(e: unknown): { ok: false; erro: string } {
  return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
}

function revalidar(id?: string) {
  revalidatePath("/orcamentos");
  if (id) revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/inicio");
  revalidatePath("/clientes", "layout");
}

// ---------------------------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------------------------

export async function criarOrcamento(entrada: { clienteId: string }): Promise<RespostaAcao & { id?: string }> {
  try {
    await exigirPapel("gestora");
    const clienteId = z.string().uuid().parse(entrada.clienteId);
    const supabase = await criarClienteServidor();
    const [{ data: c }, { data: regras }] = await Promise.all([
      supabase.from("clientes").select("residencia_endereco, residencia_bairro, residencia_cidade, obra_endereco, obra_bairro, obra_cidade").eq("id", clienteId).maybeSingle(),
      supabase.from("regras_orcamento").select("validade_padrao_dias, prazo_entrega_padrao, condicoes_padrao").maybeSingle(),
    ]);
    if (!c) return { ok: false, erro: "Cliente não encontrado." };
    const { data: o, error } = await supabase
      .from("orcamentos")
      .insert({
        cliente_id: clienteId,
        endereco_obra: enderecosDoCliente(c)[0]?.endereco ?? "",
        validade_dias: regras?.validade_padrao_dias ?? 30,
        prazo_entrega: regras?.prazo_entrega_padrao ?? "",
        condicoes_pagamento: regras?.condicoes_padrao ?? "",
        numero: 0, // o banco numera (trigger); o valor é ignorado
      })
      .select("id, numero")
      .single();
    if (error) return { ok: false, erro: error.message };
    const { error: e2 } = await supabase.from("orcamento_ambientes").insert({ id: randomUUID(), orcamento_id: o.id, ordem: 0, nome: "Sala" });
    if (e2) return { ok: false, erro: e2.message };
    revalidar();
    return { ok: true, mensagem: `Orçamento nº ${numeroOrcamento(o.numero)} criado`, id: o.id };
  } catch (e) {
    return falhou(e);
  }
}

/** Cliente novo só com nome e telefone (o resto completa depois na ficha) + orçamento para ele. */
export async function criarClienteEOrcamento(entrada: { nome: string; telefone: string }): Promise<RespostaAcao & { id?: string }> {
  try {
    await exigirPapel("gestora");
    const nome = z.string().trim().min(2, "Informe o nome do cliente.").max(120).parse(entrada.nome);
    const telefone = z.string().trim().max(30).parse(entrada.telefone);
    const supabase = await criarClienteServidor();
    const { data: c, error } = await supabase.from("clientes").insert({ nome, telefone }).select("id").single();
    if (error) return { ok: false, erro: error.message };
    return await criarOrcamento({ clienteId: c.id });
  } catch (e) {
    return falhou(e);
  }
}

// ---------------------------------------------------------------------------------------------
// Salvar o rascunho
// ---------------------------------------------------------------------------------------------

const ID = z.string().uuid();
const IDOPC = ID.nullable();
const MEDIDA = (max: number) => z.number().int().min(1).max(max).nullable();

const ITEM = z.object({
  id: ID,
  tipo: z.enum(["cortina", "persiana", "trilho", "acessorio", "servico"]),
  produtoId: IDOPC,
  modeloId: IDOPC,
  trilhoId: IDOPC,
  motorizado: z.boolean(),
  motorId: IDOPC,
  instalacaoId: IDOPC,
  cor: z.string().trim().max(60, "Cor ou detalhe: no máximo 60 caracteres."),
  larguraCm: MEDIDA(5000),
  alturaCm: MEDIDA(1000),
  quantidade: z.number().int().min(1, "Quantidade mínima: 1.").max(999),
});

const DOC = z.object({
  id: ID,
  clienteId: ID,
  enderecoObra: z.string().trim().max(300),
  validadeDias: z.number().int().min(1, "Validade de pelo menos 1 dia.").max(365, "Validade de no máximo 365 dias."),
  prazoEntrega: z.string().trim().max(120),
  condicoes: z.string().trim().max(200),
  desconto: z.object({ modo: z.enum(["pct", "brl"]), valor: z.number().int().min(0) }),
  deslocamentoCentavos: z.number().int().min(0).max(10000000),
  obsCliente: z.string().max(2000),
  obsInterna: z.string().max(2000),
  ambientes: z
    .array(z.object({ id: ID, nome: z.string().trim().min(1, "Dê um nome ao ambiente.").max(60), itens: z.array(ITEM).max(100) }))
    .max(50),
});

export type DocumentoRascunho = z.input<typeof DOC>;
export type RespostaSalvar = { ok: true; salvoEm: string; congelados: Record<string, { chave: string; precos: Precos }> } | { ok: false; erro: string };

/** Cada escolha precisa existir no catálogo, na categoria certa — e, se for escolha nova, estar ativa. */
function conferirEscolhas(i: EntradaItem, c: Catalogo, congelado: boolean): string | null {
  const categoriaPrincipal = i.tipo === "cortina" ? "tecido" : i.tipo;
  const checar = (id: string | null, categoria: string, rotulo: string) => {
    if (!id) return null;
    const p = c.produtos.find((x) => x.id === id);
    if (!p || p.categoria !== categoria) return `${rotulo} inválido.`;
    if (!p.ativo && !congelado) return `${p.nome} está inativo no catálogo.`;
    return null;
  };
  if (i.tipo === "cortina" && i.modeloId) {
    const m = c.modelos.find((x) => x.id === i.modeloId);
    if (!m) return "Modelo de confecção inválido.";
    if (!m.ativo && !congelado) return `${m.nome} está inativo no catálogo.`;
  }
  return (
    checar(i.produtoId, categoriaPrincipal, "Produto") ??
    (i.tipo === "cortina" ? checar(i.trilhoId, "trilho", "Trilho") : null) ??
    (i.motorizado ? checar(i.motorId, "acessorio", "Motor") : null) ??
    (i.tipo === "cortina" || i.tipo === "persiana" ? checar(i.instalacaoId, "servico", "Instalação") : null)
  );
}

export async function salvarOrcamento(entrada: DocumentoRascunho): Promise<RespostaSalvar> {
  try {
    await exigirPapel("gestora");
    const d = DOC.parse(entrada);
    if (d.desconto.modo === "pct" && d.desconto.valor > 10000) return { ok: false, erro: "Desconto de no máximo 100%." };
    const supabase = await criarClienteServidor();

    const [catalogo, { data: antigos }] = await Promise.all([carregarCatalogo(supabase), supabase.from("orcamento_itens").select("id, tipo, produto_id, modelo_id, trilho_id, motorizado, motor_id, instalacao_id, precos").eq("orcamento_id", d.id)]);
    const congeladosAntes = new Map(
      (antigos ?? []).map((a) => [
        a.id,
        {
          chave: chaveDePreco({
            id: a.id,
            tipo: a.tipo,
            produtoId: a.produto_id,
            modeloId: a.modelo_id,
            trilhoId: a.trilho_id,
            motorizado: a.motorizado,
            motorId: a.motor_id,
            instalacaoId: a.instalacao_id,
            cor: "",
            larguraCm: null,
            alturaCm: null,
            quantidade: 1,
          }),
          precos: a.precos as unknown as Precos,
        },
      ]),
    );

    const ambientes: { id: string; ordem: number; nome: string }[] = [];
    const itens: Record<string, unknown>[] = [];
    const totais: number[] = [];
    const congelados: Record<string, { chave: string; precos: Precos }> = {};

    for (const [ia, a] of d.ambientes.entries()) {
      ambientes.push({ id: a.id, ordem: ia, nome: a.nome });
      for (const [ii, i] of a.itens.entries()) {
        const antes = congeladosAntes.get(i.id);
        const mantem = !!antes && antes.chave === chaveDePreco(i);
        const problema = conferirEscolhas(i, catalogo, mantem);
        if (problema) return { ok: false, erro: `${a.nome}, item ${ii + 1}: ${problema}` };
        const precos = precosDoItem(i, catalogo, antes);
        const calc = calcularItem(i, precos);
        congelados[i.id] = { chave: chaveDePreco(i), precos };
        totais.push(calc.totalCentavos);
        itens.push({
          id: i.id,
          ambiente_id: a.id,
          ordem: ii,
          tipo: i.tipo,
          produto_id: i.produtoId,
          modelo_id: i.tipo === "cortina" ? i.modeloId : null,
          trilho_id: i.tipo === "cortina" ? i.trilhoId : null,
          motorizado: (i.tipo === "cortina" || i.tipo === "persiana") && i.motorizado,
          motor_id: i.motorId,
          instalacao_id: i.tipo === "cortina" || i.tipo === "persiana" ? i.instalacaoId : null,
          cor: i.cor,
          largura_cm: i.larguraCm,
          altura_cm: i.alturaCm,
          quantidade: i.quantidade,
          precos,
          linhas: calc.linhas,
          descricao: calc.descricao.slice(0, 300) || "Item",
          medidas: calc.medidas,
          unitario_centavos: calc.unitarioCentavos,
          total_centavos: calc.totalCentavos,
        });
      }
    }

    const t = calcularTotais(totais, d.desconto, d.deslocamentoCentavos);
    const { data: salvoEm, error } = await supabase.rpc("salvar_orcamento", {
      p_id: d.id,
      p_cabecalho: {
        cliente_id: d.clienteId,
        endereco_obra: d.enderecoObra,
        validade_dias: d.validadeDias,
        prazo_entrega: d.prazoEntrega,
        condicoes_pagamento: d.condicoes,
        desconto_modo: d.desconto.modo,
        desconto_valor: d.desconto.valor,
        deslocamento_centavos: d.deslocamentoCentavos,
        subtotal_centavos: t.subtotal,
        desconto_centavos: t.desconto,
        total_centavos: t.total,
        obs_cliente: d.obsCliente,
        obs_interna: d.obsInterna,
      },
      p_ambientes: ambientes,
      p_itens: itens as never,
    });
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/orcamentos");
    return { ok: true, salvoEm: salvoEm as string, congelados };
  } catch (e) {
    return falhou(e);
  }
}

// ---------------------------------------------------------------------------------------------
// Situação
// ---------------------------------------------------------------------------------------------

const MUDANCA = z.object({
  id: ID,
  para: z.enum(["enviado", "aprovado", "recusado", "rascunho", "cancelado"]),
  motivo: z.string().trim().max(500).optional(),
});

const MENSAGEM: Record<z.infer<typeof MUDANCA>["para"], string> = {
  enviado: "Orçamento enviado · a validade começou a contar",
  aprovado: "Orçamento aprovado",
  recusado: "Orçamento marcado como recusado",
  rascunho: "Orçamento de volta para rascunho",
  cancelado: "Rascunho descartado",
};

export async function mudarSituacao(entrada: z.input<typeof MUDANCA>): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const m = MUDANCA.parse(entrada);
    const supabase = await criarClienteServidor();
    if (m.para === "enviado") {
      const { data: itens } = await supabase.from("orcamento_itens").select("descricao, total_centavos").eq("orcamento_id", m.id);
      if (!itens?.length) return { ok: false, erro: "Inclua ao menos um item antes de enviar." };
      const incompleto = itens.find((i) => i.total_centavos <= 0);
      if (incompleto) return { ok: false, erro: `Item incompleto: ${incompleto.descricao}. Complete as medidas e o produto.` };
    }
    const { data, error } = await supabase
      .from("orcamentos")
      .update({ status: m.para, ...(m.para === "recusado" ? { resposta_motivo: m.motivo ?? "" } : {}) })
      .eq("id", m.id)
      .select("id");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Orçamento não encontrado." };
    revalidar(m.id);
    return { ok: true, mensagem: MENSAGEM[m.para] };
  } catch (e) {
    return falhou(e);
  }
}

export async function salvarObsInterna(entrada: { id: string; texto: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("orcamentos")
      .update({ obs_interna: z.string().max(2000).parse(entrada.texto) })
      .eq("id", ID.parse(entrada.id));
    if (error) return { ok: false, erro: error.message };
    revalidar(entrada.id);
    return { ok: true, mensagem: "Observação interna salva" };
  } catch (e) {
    return falhou(e);
  }
}
