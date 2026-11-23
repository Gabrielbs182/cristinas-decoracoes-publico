"use server";

/**
 * Pedido de correção feito pela funcionária (pelo celular). Tudo com a sessão dela: o RLS só deixa
 * criar pedido para si mesma, e o Storage só aceita o anexo na pasta dela.
 */
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { exigirPapel } from "@/lib/auth";
import { minDeHhmm, segundaDe } from "@/lib/ponto";
import { criarClienteServidor } from "@/lib/supabase/server";

const TIPOS_ANEXO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };
const LIMITE_ANEXO = 10 * 1024 * 1024;
const REPETIDO = "Você já pediu essa correção. Aguarde a resposta da gestora.";

const PEDIDO = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o dia."),
  pedido: z.enum(["E", "A", "V", "S", "atestado", "falta_justificada"], { message: "Escolha o que corrigir." }),
  hora: z.string().optional(),
  motivo: z.string().trim().min(3, "Conte o motivo (pelo menos 3 letras).").max(500),
});

export async function pedirCorrecao(formData: FormData): Promise<RespostaAcao> {
  try {
    const sessao = await exigirPapel("funcionaria");
    const fid = sessao.funcionariaId!;
    const p = PEDIDO.parse({ data: formData.get("data"), pedido: formData.get("pedido"), hora: formData.get("hora") ?? undefined, motivo: formData.get("motivo") });
    const ehBatida = p.pedido.length === 1;
    const minutos = ehBatida ? minDeHhmm(p.hora ?? "") : null;
    if (ehBatida && minutos === null) return { ok: false, erro: "Informe o horário em HH:MM." };
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    if (p.data > hoje) return { ok: false, erro: "Não dá para pedir correção de um dia que ainda não chegou." };

    const supabase = await criarClienteServidor();

    // Mesmo pedido ainda sem resposta: não duplica.
    let repetido = supabase.from("solicitacoes_correcao").select("id", { count: "exact", head: true }).eq("funcionaria_id", fid).eq("data", p.data).eq("status", "pendente");
    repetido = ehBatida ? repetido.eq("tipo_batida", p.pedido as "E") : repetido.not("ocorrencia", "is", null);
    const { count } = await repetido;
    if (count) return { ok: false, erro: REPETIDO };

    const { data: semana } = await supabase.from("semanas").select("status").eq("segunda", segundaDe(p.data)).maybeSingle();
    if (semana?.status === "fechada") return { ok: false, erro: "Essa semana já foi fechada. Fale com a gestora." };

    let anexo_path: string | null = null;
    const foto = formData.get("foto");
    if (foto instanceof File && foto.size > 0) {
      const ext = TIPOS_ANEXO[foto.type];
      if (!ext) return { ok: false, erro: "Anexo precisa ser foto (JPG, PNG, WEBP, HEIC) ou PDF." };
      if (foto.size > LIMITE_ANEXO) return { ok: false, erro: "Anexo grande demais (máximo 10 MB)." };
      anexo_path = `${fid}/${p.data}-${randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("anexos").upload(anexo_path, foto, { contentType: foto.type });
      if (error) return { ok: false, erro: `Não deu para enviar o anexo: ${error.message}` };
    }

    const { error } = await supabase
      .from("solicitacoes_correcao")
      .insert({
        funcionaria_id: fid,
        data: p.data,
        tipo_batida: ehBatida ? (p.pedido as "E" | "A" | "V" | "S") : null,
        hora_seg: ehBatida ? minutos! * 60 : null,
        ocorrencia: ehBatida ? null : (p.pedido as "atestado" | "falta_justificada"),
        motivo: p.motivo,
        anexo_path,
        criada_por: sessao.userId,
      });
    // 23505: o mesmo pedido chegou duas vezes ao mesmo tempo (índice único de pedido pendente).
    if (error) return { ok: false, erro: error.code === "23505" ? REPETIDO : error.message };

    revalidatePath("/meu-ponto", "layout");
    revalidatePath("/ponto", "layout");
    revalidatePath("/inicio");
    return { ok: true, mensagem: "Pedido enviado para a gestora" };
  } catch (e) {
    return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
  }
}
