"use server";

/**
 * Resposta da gestora aos pedidos de correção. Aprovar recalcula o dia e decide se a batida pedida
 * é nova (adicionar) ou já existe com outro horário (alterar); o banco (aprovar_solicitacao) só aceita
 * um lançamento que corresponda ao pedido e grava tudo de uma vez.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPapel } from "@/lib/auth";
import { segundaDe } from "@/lib/ponto";
import { carregarSemana } from "@/lib/ponto/servidor";
import { planoDeAprovacao } from "@/lib/ponto/solicitacoes";
import { criarClienteServidor } from "@/lib/supabase/server";

import type { RespostaAcao } from "../acoes";

const ID = z.number().int().positive();

function revalidar() {
  revalidatePath("/ponto", "layout");
  revalidatePath("/inicio");
  revalidatePath("/meu-ponto", "layout");
}

export async function aprovarSolicitacao(entrada: { id: number; resposta?: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const id = ID.parse(entrada.id);
    const supabase = await criarClienteServidor();
    const { data: s } = await supabase.from("solicitacoes_correcao").select("*").eq("id", id).maybeSingle();
    if (!s) return { ok: false, erro: "Solicitação não encontrada." };
    if (s.status !== "pendente") return { ok: false, erro: "Esta solicitação já foi respondida." };

    const semana = await carregarSemana(supabase, segundaDe(s.data), { funcionariaId: s.funcionaria_id });
    const dia = semana.funcionarias[0]?.resultado.dias.find((d) => d.data === s.data);
    if (!dia) return { ok: false, erro: "Não encontrei o dia da solicitação." };
    if (semana.status === "fechada") return { ok: false, erro: "A semana já foi fechada. Reabra a semana para aprovar." };

    const plano = planoDeAprovacao(dia, s);
    const { error } = await supabase.rpc("aprovar_solicitacao", {
      p_id: id,
      p_lancamento: plano.lancamento as never,
      p_resposta: entrada.resposta?.trim() || "Aprovado.",
    });
    if (error) return { ok: false, erro: error.message };
    revalidar();
    return { ok: true, mensagem: `Aprovado · ${plano.descricao.toLowerCase()}` };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function recusarSolicitacao(entrada: { id: number; resposta: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const id = ID.parse(entrada.id);
    const resposta = z.string().trim().min(3, "Escreva a resposta para a funcionária.").max(500).parse(entrada.resposta);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("solicitacoes_correcao")
      .update({ status: "recusada", resposta })
      .eq("id", id)
      .eq("status", "pendente")
      .select("id");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Esta solicitação já foi respondida." };
    revalidar();
    return { ok: true, mensagem: "Solicitação recusada · resposta enviada" };
  } catch (e) {
    return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
  }
}
