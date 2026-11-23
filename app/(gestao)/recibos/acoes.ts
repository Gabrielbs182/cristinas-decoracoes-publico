"use server";

/**
 * Recibos (só a gestora emite e cancela). O banco garante número sem buraco, orçamento aprovado e valor
 * dentro do saldo (trigger emite_recibo); aqui só se monta o texto e se valida o formulário.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { exigirPapel } from "@/lib/auth";
import { centavosDeTexto } from "@/lib/vendas/numeros";
import { numeroRecibo, textoReferente } from "@/lib/vendas/recibos";
import { hojeSP } from "@/lib/vendas/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

function falhou(e: unknown): { ok: false; erro: string } {
  return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
}

function revalidar(orcamentoId?: string | null) {
  revalidatePath("/recibos", "layout");
  revalidatePath("/inicio");
  revalidatePath("/orcamentos");
  if (orcamentoId) revalidatePath(`/orcamentos/${orcamentoId}`);
  revalidatePath("/clientes", "layout");
}

const RECIBO = z.object({
  tipo: z.enum(["sinal", "parcela", "quitacao", "avulso"]),
  orcamentoId: z.string().uuid().nullable(),
  pagador: z.string().trim().min(2, "Informe quem pagou.").max(120),
  avulso: z.string().trim().max(280).optional(),
  valor: z
    .string()
    .transform((v) => centavosDeTexto(v))
    .refine((v): v is number => v !== null && v > 0, "Valor em reais, maior que zero (ex.: 1.250,00)."),
  forma: z.enum(["pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia"]),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data do pagamento."),
});

export async function emitirRecibo(entrada: z.input<typeof RECIBO>): Promise<RespostaAcao & { id?: string }> {
  try {
    await exigirPapel("gestora");
    const r = RECIBO.parse(entrada);
    if (r.data > hojeSP()) return { ok: false, erro: "A data do pagamento não pode ser futura." };
    if ((r.tipo === "avulso") !== !r.orcamentoId) return { ok: false, erro: "Recibo de orçamento precisa do orçamento; avulso não tem orçamento." };
    const supabase = await criarClienteServidor();

    let referente: string;
    if (r.orcamentoId) {
      const [{ data: o }, { data: ambientes }] = await Promise.all([
        supabase.from("orcamentos").select("numero").eq("id", r.orcamentoId).maybeSingle(),
        supabase.from("orcamento_ambientes").select("nome, ordem").eq("orcamento_id", r.orcamentoId).order("ordem"),
      ]);
      if (!o) return { ok: false, erro: "Orçamento não encontrado." };
      referente = textoReferente(r.tipo, { orcamentoNumero: o.numero, ambientes: (ambientes ?? []).map((a) => a.nome) });
    } else {
      if (!r.avulso || r.avulso.length < 3) return { ok: false, erro: "Diga a que se refere o pagamento (ex.: conserto de varão)." };
      referente = textoReferente("avulso", { avulso: r.avulso });
    }

    const { data, error } = await supabase
      .from("recibos")
      .insert({
        numero: 0, // o banco numera (trigger); o valor é ignorado
        tipo: r.tipo,
        orcamento_id: r.orcamentoId,
        pagador: r.pagador,
        referente: referente.slice(0, 300),
        valor_centavos: r.valor,
        forma: r.forma,
        data_pagamento: r.data,
      })
      .select("id, numero")
      .single();
    if (error) return { ok: false, erro: error.message };
    revalidar(r.orcamentoId);
    return { ok: true, mensagem: `Recibo nº ${numeroRecibo(data.numero)} emitido`, id: data.id };
  } catch (e) {
    return falhou(e);
  }
}

export async function cancelarRecibo(entrada: { id: string; motivo: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const id = z.string().uuid().parse(entrada.id);
    const motivo = z.string().trim().min(3, "Escreva o motivo do cancelamento.").max(500).parse(entrada.motivo);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.from("recibos").update({ status: "cancelado", motivo_cancelamento: motivo }).eq("id", id).eq("status", "emitido").select("numero, orcamento_id");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Recibo não encontrado ou já cancelado." };
    revalidar(data[0]!.orcamento_id);
    return { ok: true, mensagem: `Recibo nº ${numeroRecibo(data[0]!.numero)} cancelado · o número não será reaproveitado` };
  } catch (e) {
    return falhou(e);
  }
}
