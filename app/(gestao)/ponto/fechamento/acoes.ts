"use server";

/**
 * Fechamento e reabertura da semana, espelhos e ajuste manual de saldo (gestora).
 * A semana é recalculada aqui na hora de fechar; o banco (fechar_semana) garante ordem e atomicidade.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPapel } from "@/lib/auth";
import { gerarEspelhosDaSemana } from "@/lib/impressos/servidor";
import { dataBr, minDeHhmm, somarDias } from "@/lib/ponto";
import { impedimentosDoFechamento, montarFechamento } from "@/lib/ponto/fechamento";
import { segundaDoParametro } from "@/lib/ponto/parametros";
import { carregarSemana, semanaAbertaAnterior, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

import type { RespostaAcao } from "../acoes";

const MOTIVO = z.string().trim().min(3, "Escreva o motivo (pelo menos 3 letras).").max(500);

function segundaValida(s: string): string {
  const seg = segundaDoParametro(s);
  if (!seg || seg !== s) throw new Error("Semana inválida.");
  return seg;
}

const erro = (e: unknown): RespostaAcao => ({
  ok: false,
  erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado.",
});

function revalidar() {
  revalidatePath("/ponto", "layout");
  revalidatePath("/rh", "layout");
  revalidatePath("/inicio");
  revalidatePath("/meu-ponto");
}

export async function fecharSemana(entrada: { segunda: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const segunda = segundaValida(entrada.segunda);
    const supabase = await criarClienteServidor();
    const [semana, anterior, { count: solicitacoes }] = await Promise.all([
      carregarSemana(supabase, segunda),
      semanaAbertaAnterior(supabase, segunda),
      supabase.from("solicitacoes_correcao").select("id", { count: "exact", head: true }).eq("status", "pendente").gte("data", segunda).lte("data", somarDias(segunda, 6)),
    ]);
    const impedimentos = impedimentosDoFechamento({
      temBatidas: semana.temBatidas,
      status: semana.status,
      bloqueios: semana.funcionarias.reduce((n, f) => n + f.resultado.bloqueios, 0),
      idsDesconhecidos: semana.idsDesconhecidos.length,
      solicitacoesPendentes: solicitacoes ?? 0,
      semanaAbertaAnterior: anterior,
    });
    if (impedimentos.length) return { ok: false, erro: impedimentos.join(" ") };

    const { resultados, dias } = montarFechamento(segunda, semana.funcionarias);
    const { error } = await supabase.rpc("fechar_semana", {
      p_segunda: segunda,
      p_resultados: resultados as never,
      p_dias: dias as never,
      p_regras: semana.regras as never,
    });
    if (error) return { ok: false, erro: error.message };

    // A semana já está fechada e travada; se algum PDF falhar, dá para gerar de novo pela tela.
    const { gerados, falhas } = await gerarEspelhosDaSemana(supabase, segunda);
    revalidar();
    return falhas.length
      ? { ok: true, mensagem: `Semana fechada. ${gerados} espelho(s) gerado(s); ${falhas.length} falharam — use "Gerar espelhos que faltam".` }
      : { ok: true, mensagem: `Semana fechada · ${gerados} espelho(s) gerado(s)` };
  } catch (e) {
    return erro(e);
  }
}

export async function reabrirSemana(entrada: { segunda: string; motivo: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const segunda = segundaValida(entrada.segunda);
    const motivo = MOTIVO.parse(entrada.motivo);
    const supabase = await criarClienteServidor();
    const { error } = await supabase.rpc("reabrir_semana", { p_segunda: segunda, p_motivo: motivo });
    if (error) return { ok: false, erro: error.message };
    revalidar();
    return { ok: true, mensagem: `Semana de ${dataBr(segunda)} reaberta` };
  } catch (e) {
    return erro(e);
  }
}

export async function gerarEspelhosQueFaltam(entrada: { segunda: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const segunda = segundaValida(entrada.segunda);
    const supabase = await criarClienteServidor();
    const { gerados, falhas } = await gerarEspelhosDaSemana(supabase, segunda, { apenasFaltantes: true });
    revalidar();
    if (falhas.length) return { ok: false, erro: `${falhas.length} espelho(s) falharam: ${falhas.join("; ")}` };
    return { ok: true, mensagem: gerados ? `${gerados} espelho(s) gerado(s)` : "Todos os espelhos já existiam" };
  } catch (e) {
    return erro(e);
  }
}

const AJUSTE = z.object({
  funcionariaId: z.string().uuid(),
  sinal: z.enum(["+", "-"]),
  horas: z.string(),
  motivo: MOTIVO,
});

export async function lancarAjusteSaldo(entrada: z.input<typeof AJUSTE>): Promise<RespostaAcao> {
  try {
    const sessao = await exigirPapel("gestora");
    const { funcionariaId, sinal, horas, motivo } = AJUSTE.parse(entrada);
    const minutos = minDeHhmm(horas);
    if (!minutos) return { ok: false, erro: "Informe as horas do ajuste em HH:MM (maior que zero)." };
    const supabase = await criarClienteServidor();
    // O ajuste entra na semana em que se trabalha agora (sempre aberta: a seguinte à última fechada).
    const segunda = await semanaPadrao(supabase);
    const { error } = await supabase.from("ajustes_saldo").insert({
      funcionaria_id: funcionariaId,
      segunda,
      minutos: sinal === "+" ? minutos : -minutos,
      motivo,
      autor: sessao.userId,
    });
    if (error) return { ok: false, erro: error.message };
    revalidar();
    return { ok: true, mensagem: `Ajuste lançado na semana de ${dataBr(segunda)}` };
  } catch (e) {
    return erro(e);
  }
}
