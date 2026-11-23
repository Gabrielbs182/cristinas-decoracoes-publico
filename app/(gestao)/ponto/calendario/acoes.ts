"use server";

/** Feriados (municipais, pontes, facultativos) e regras de jornada com vigência. */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { exigirPapel } from "@/lib/auth";
import { dataBr, minDeHhmm } from "@/lib/ponto";
import { criarClienteServidor } from "@/lib/supabase/server";

function falhou(e: unknown): RespostaAcao {
  return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
}

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data.");

const FERIADO = z.object({
  data: DATA,
  nome: z.string().trim().min(3, "Dê um nome ao feriado.").max(80),
  tipo: z.enum(["nacional", "municipal", "ponte", "facultativo"]),
});

export async function adicionarFeriado(entrada: z.input<typeof FERIADO>): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const f = FERIADO.parse(entrada);
    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("feriados").insert(f);
    if (error) return { ok: false, erro: error.code === "23505" ? `Já há feriado em ${dataBr(f.data)}.` : error.message };
    revalidatePath("/ponto", "layout");
    return { ok: true, mensagem: `Feriado em ${dataBr(f.data)} cadastrado` };
  } catch (e) {
    return falhou(e);
  }
}

export async function removerFeriado(entrada: { data: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const data = DATA.parse(entrada.data);
    const supabase = await criarClienteServidor();
    const { data: apagados, error } = await supabase.from("feriados").delete().eq("data", data).select("data");
    if (error) return { ok: false, erro: error.message };
    if (!apagados?.length) return { ok: false, erro: "Feriado não encontrado." };
    revalidatePath("/ponto", "layout");
    return { ok: true, mensagem: `Feriado de ${dataBr(data)} removido` };
  } catch (e) {
    return falhou(e);
  }
}

const HORA = (rotulo: string) =>
  z
    .string()
    .trim()
    .refine((v) => minDeHhmm(v) !== null, `${rotulo}: use HH:MM.`)
    .transform((v) => minDeHhmm(v)!);
const MINUTOS = (rotulo: string, max: number) => z.coerce.number({ message: `${rotulo}: só números.` }).int().min(0).max(max, `${rotulo}: no máximo ${max} min.`);

const REGRAS = z.object({
  cargaSegQui: HORA("Carga de segunda a quinta"),
  cargaSex: HORA("Carga de sexta"),
  entradaPrevista: HORA("Entrada prevista"),
  almocoInicioPrevisto: HORA("Início previsto do almoço"),
  almocoPadrao: HORA("Almoço padrão").refine((m) => m <= 240, "Almoço padrão: no máximo 4h."),
  horaCorte: HORA("Hora de corte").refine((m) => m > 0, "Hora de corte: maior que zero."),
  toleranciaCorte: MINUTOS("Tolerância do corte", 120),
  toleranciaAtraso: MINUTOS("Tolerância de atraso", 120),
  janelaDuplicada: MINUTOS("Janela de batida repetida", 60),
});

export async function salvarRegras(entrada: z.input<typeof REGRAS>): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const r = REGRAS.parse(entrada);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("definir_regras", {
      p: {
        carga_seg_qui_min: r.cargaSegQui,
        carga_sex_min: r.cargaSex,
        entrada_prevista_min: r.entradaPrevista,
        almoco_inicio_previsto_min: r.almocoInicioPrevisto,
        almoco_padrao_min: r.almocoPadrao,
        hora_corte_min: r.horaCorte,
        tolerancia_corte_min: r.toleranciaCorte,
        tolerancia_atraso_min: r.toleranciaAtraso,
        janela_duplicada_min: r.janelaDuplicada,
      },
    });
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/ponto", "layout");
    revalidatePath("/inicio");
    revalidatePath("/meu-ponto", "layout");
    return { ok: true, mensagem: `Regras salvas · valem a partir da semana de ${dataBr(data)}` };
  } catch (e) {
    return falhou(e);
  }
}
