"use server";

/**
 * Ações do ponto (gestora). Toda ação RECALCULA o dia no servidor antes de gravar: se a pendência
 * mudou desde que a tela foi carregada, recusa em vez de aplicar uma sugestão velha.
 * O RLS e os triggers do banco continuam valendo por baixo (gestora, semana aberta, diário append-only).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPapel } from "@/lib/auth";
import { type AcaoSugerida, type CodigoPendencia, minDeHhmm, NOME_OCORRENCIA, type ResultadoDia, segundaDe } from "@/lib/ponto";
import { carregarSemana } from "@/lib/ponto/servidor";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { criarClienteServidor } from "@/lib/supabase/server";

export type RespostaAcao = { ok: true; mensagem: string } | { ok: false; erro: string };

type LinhaLancamento = TablesInsert<"ponto_lancamentos">;

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const UUID = z.string().uuid();
const TIPO = z.enum(["E", "A", "V", "S"]);
const MOTIVO = z.string().trim().min(3, "Escreva o motivo (pelo menos 3 letras).").max(500);

async function contexto(funcionariaId: string, data: string) {
  const sessao = await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const semana = await carregarSemana(supabase, segundaDe(data), { funcionariaId });
  const dia = semana.funcionarias[0]?.resultado.dias.find((d) => d.data === data);
  if (!dia) throw new Error("Funcionária ou dia não encontrado.");
  return { sessao, supabase, semana, dia };
}

/** "c123" → batida da catraca; "m45" → batida adicionada pelo lançamento 45. */
function alvo(ref: string, dia: ResultadoDia): Pick<LinhaLancamento, "batida_id" | "lancamento_alvo_id"> {
  if (!dia.batidas.some((b) => b.ref === ref)) throw new Error("Essa batida não é deste dia.");
  const id = Number(ref.slice(1));
  return ref.startsWith("c") ? { batida_id: id, lancamento_alvo_id: null } : { batida_id: null, lancamento_alvo_id: id };
}

async function gravar(linhas: LinhaLancamento[], mensagem: string): Promise<RespostaAcao> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("ponto_lancamentos").insert(linhas);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/ponto", "layout");
  revalidatePath("/inicio");
  return { ok: true, mensagem };
}

function falhou(e: unknown): RespostaAcao {
  return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
}

const ESQUEMA_PENDENCIA = z.object({ funcionariaId: UUID, data: DATA, codigo: z.string().min(3) });

/** Lançamentos que aplicam a sugestão da pendência `codigo` no dia (erro se ela mudou ou não tem correção automática). */
function linhasDaSugestao(dia: ResultadoDia, funcionariaId: string, codigo: CodigoPendencia, autor: string): { linhas: LinhaLancamento[]; titulo: string; aviso: boolean } {
  const p = dia.pendencias.find((x) => x.codigo === codigo);
  if (!p) throw new Error("Essa pendência já foi resolvida ou mudou. Atualize a página.");
  if (!p.sugestao.acoes.length) throw new Error("Esta pendência não tem correção automática. Ajuste no detalhe do dia.");
  const base = { funcionaria_id: funcionariaId, data: dia.data, autor };
  const motivo = p.severidade === "aviso" ? `Confirmado: ${p.titulo}` : `Sugestão aceita: ${p.sugestao.texto}`;
  const linhas = p.sugestao.acoes.map((a: AcaoSugerida): LinhaLancamento => {
    switch (a.tipo) {
      case "adicionar_batida":
        return { ...base, tipo: "adicionar_batida", hora_seg: a.horaSeg, tipo_batida: a.tipoBatida, motivo };
      case "trocar_tipo":
        return { ...base, tipo: "trocar_tipo", ...alvo(a.ref, dia), tipo_batida: a.tipoBatida, motivo };
      case "desconsiderar_batida":
        return { ...base, tipo: "desconsiderar_batida", ...alvo(a.ref, dia), motivo };
      case "confirmar":
        return { ...base, tipo: "resolver_pendencia", pendencia_codigo: p.codigo, assinatura: dia.assinatura, motivo };
    }
  });
  return { linhas, titulo: p.titulo, aviso: p.severidade === "aviso" };
}

export async function aceitarSugestao(entrada: { funcionariaId: string; data: string; codigo: CodigoPendencia }): Promise<RespostaAcao> {
  try {
    const { funcionariaId, data, codigo } = ESQUEMA_PENDENCIA.parse(entrada);
    const { sessao, dia } = await contexto(funcionariaId, data);
    const { linhas, titulo, aviso } = linhasDaSugestao(dia, funcionariaId, codigo as CodigoPendencia, sessao.userId);
    return gravar(linhas, aviso ? "Aviso confirmado" : `Sugestão aplicada · ${titulo}`);
  } catch (e) {
    return falhou(e);
  }
}

/**
 * Várias pendências do mesmo tipo de uma vez. Recalcula cada dia; se alguma mudou, não grava nada
 * (um único INSERT: ou entram todas, ou nenhuma).
 */
export async function aceitarSugestoes(entrada: { itens: { funcionariaId: string; data: string; codigo: CodigoPendencia }[] }): Promise<RespostaAcao> {
  try {
    const sessao = await exigirPapel("gestora");
    const itens = z.array(ESQUEMA_PENDENCIA).min(1).max(100).parse(entrada.itens);
    if (new Set(itens.map((i) => i.codigo)).size > 1) return { ok: false, erro: "Selecione pendências do mesmo tipo para resolver de uma vez." };
    const supabase = await criarClienteServidor();
    const semanas = new Map<string, Awaited<ReturnType<typeof carregarSemana>>>();
    const linhas: LinhaLancamento[] = [];
    for (const i of itens) {
      const chave = `${i.funcionariaId}|${segundaDe(i.data)}`;
      if (!semanas.has(chave)) semanas.set(chave, await carregarSemana(supabase, segundaDe(i.data), { funcionariaId: i.funcionariaId }));
      const dia = semanas.get(chave)!.funcionarias[0]?.resultado.dias.find((d) => d.data === i.data);
      if (!dia) throw new Error("Funcionária ou dia não encontrado.");
      linhas.push(...linhasDaSugestao(dia, i.funcionariaId, i.codigo as CodigoPendencia, sessao.userId).linhas);
    }
    return gravar(linhas, `${itens.length} pendência(s) resolvida(s)`);
  } catch (e) {
    return falhou(e);
  }
}

export async function justificarPendencia(entrada: { funcionariaId: string; data: string; codigo: CodigoPendencia; justificativa: string }): Promise<RespostaAcao> {
  try {
    const { funcionariaId, data, codigo } = ESQUEMA_PENDENCIA.parse(entrada);
    const justificativa = MOTIVO.parse(entrada.justificativa);
    const { sessao, dia } = await contexto(funcionariaId, data);
    const p = dia.pendencias.find((x) => x.codigo === codigo);
    if (!p) return { ok: false, erro: "Essa pendência já foi resolvida ou mudou. Atualize a página." };
    return gravar(
      [{ funcionaria_id: funcionariaId, data, autor: sessao.userId, tipo: "resolver_pendencia", pendencia_codigo: codigo, assinatura: dia.assinatura, motivo: justificativa }],
      "Justificativa registrada",
    );
  } catch (e) {
    return falhou(e);
  }
}

const ESQUEMA_LANCAMENTO = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("adicionar_batida"), hora: z.string(), tipoBatida: TIPO }),
  z.object({ tipo: z.literal("alterar_horario"), ref: z.string(), hora: z.string() }),
  z.object({ tipo: z.literal("desconsiderar_batida"), ref: z.string() }),
  z.object({ tipo: z.literal("trocar_tipo"), ref: z.string(), tipoBatida: TIPO }),
  z.object({ tipo: z.literal("ocorrencia"), ocorrencia: z.enum(["atestado", "falta_justificada", "folga", "feriado", "falta"]) }),
  z.object({ tipo: z.literal("cancelar"), lancamentoId: z.number().int().positive() }),
]);

export type EntradaLancamento = z.input<typeof ESQUEMA_LANCAMENTO>;

export async function lancarNoDia(entrada: { funcionariaId: string; data: string; motivo: string; lancamento: EntradaLancamento }): Promise<RespostaAcao> {
  try {
    const funcionariaId = UUID.parse(entrada.funcionariaId);
    const data = DATA.parse(entrada.data);
    const motivo = MOTIVO.parse(entrada.motivo);
    const l = ESQUEMA_LANCAMENTO.parse(entrada.lancamento);
    const { sessao, dia } = await contexto(funcionariaId, data);
    const base = { funcionaria_id: funcionariaId, data, autor: sessao.userId, motivo };

    const horaSeg = (h: string) => {
      const m = minDeHhmm(h);
      if (m === null) throw new Error("Horário inválido. Use HH:MM.");
      return m * 60;
    };

    let linha: LinhaLancamento;
    let mensagem: string;
    switch (l.tipo) {
      case "adicionar_batida":
        linha = { ...base, tipo: l.tipo, hora_seg: horaSeg(l.hora), tipo_batida: l.tipoBatida };
        mensagem = `Batida das ${l.hora} adicionada`;
        break;
      case "alterar_horario":
        linha = { ...base, tipo: l.tipo, ...alvo(l.ref, dia), hora_seg: horaSeg(l.hora) };
        mensagem = `Horário alterado para ${l.hora}`;
        break;
      case "desconsiderar_batida":
        linha = { ...base, tipo: l.tipo, ...alvo(l.ref, dia) };
        mensagem = "Batida desconsiderada";
        break;
      case "trocar_tipo":
        linha = { ...base, tipo: l.tipo, ...alvo(l.ref, dia), tipo_batida: l.tipoBatida };
        mensagem = "Tipo da batida trocado";
        break;
      case "ocorrencia":
        linha = { ...base, tipo: l.tipo, ocorrencia: l.ocorrencia };
        mensagem = `${NOME_OCORRENCIA[l.ocorrencia]} lançado`;
        break;
      case "cancelar":
        linha = { ...base, tipo: l.tipo, lancamento_alvo_id: l.lancamentoId };
        mensagem = "Lançamento desfeito";
        break;
    }
    return gravar([linha], mensagem);
  } catch (e) {
    return falhou(e);
  }
}

export async function vincularIdCatraca(entrada: { enNo: string; funcionariaId: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const enNo = z.string().regex(/^\d{9}$/).parse(entrada.enNo);
    const funcionariaId = UUID.parse(entrada.funcionariaId);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("vincular_id_catraca", { p_en_no: enNo, p_funcionaria: funcionariaId });
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/ponto", "layout");
    return { ok: true, mensagem: `ID vinculado · ${data} batidas adotadas` };
  } catch (e) {
    return falhou(e);
  }
}

export async function ignorarIdCatraca(entrada: { enNo: string; motivo: string }): Promise<RespostaAcao> {
  try {
    const sessao = await exigirPapel("gestora");
    const enNo = z.string().regex(/^\d{9}$/).parse(entrada.enNo);
    const motivo = MOTIVO.parse(entrada.motivo);
    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("catraca_ids_ignorados").insert({ en_no: enNo, motivo, autor: sessao.userId });
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/ponto", "layout");
    return { ok: true, mensagem: "ID ignorado. As batidas continuam guardadas." };
  } catch (e) {
    return falhou(e);
  }
}
