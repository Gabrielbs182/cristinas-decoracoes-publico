"use server";

/** Dados da empresa (cabeçalho dos PDFs e recibos). */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { exigirPapel } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";

const TEXTO = (max: number) => z.string().trim().max(max);

const EMPRESA = z.object({
  nome_fantasia: z.string().trim().min(2, "Informe o nome da empresa.").max(80),
  razao_social: TEXTO(120),
  cnpj: TEXTO(20).refine((v) => v === "" || v.replace(/\D/g, "").length === 14, "CNPJ com 14 dígitos."),
  endereco: TEXTO(160),
  cidade_uf: TEXTO(60),
  telefone: TEXTO(30),
  email: TEXTO(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido."),
  chave_pix: TEXTO(120),
});

export async function salvarEmpresa(entrada: z.input<typeof EMPRESA>): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const dados = EMPRESA.parse(entrada);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.from("empresa").update(dados).eq("id", true).select("id");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Cadastro da empresa não encontrado." };
    revalidatePath("/", "layout");
    return { ok: true, mensagem: "Dados da empresa salvos · valem para os próximos PDFs" };
  } catch (e) {
    return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
  }
}

const PADROES = z.object({
  proximoNumero: z.coerce.number({ message: "Próximo orçamento: só números." }).int().min(1).max(999999),
  proximoRecibo: z.coerce.number({ message: "Próximo recibo: só números." }).int().min(1).max(999999),
  validadeDias: z.coerce.number({ message: "Validade: só números." }).int().min(1, "Validade de pelo menos 1 dia.").max(365, "Validade de no máximo 365 dias."),
  prazoEntrega: z.string().trim().max(120),
  condicoes: z.string().trim().max(200),
});

/** Padrões do orçamento novo e o próximo número (para continuar a numeração que a loja já usa). */
export async function salvarPadroesOrcamento(entrada: z.input<typeof PADROES>): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const p = PADROES.parse(entrada);
    const supabase = await criarClienteServidor();
    const { data: atuais } = await supabase.from("numeracao").select("tipo, proximo");
    for (const [tipo, proximo] of [
      ["orcamento", p.proximoNumero],
      ["recibo", p.proximoRecibo],
    ] as const) {
      if (atuais?.find((a) => a.tipo === tipo)?.proximo === proximo) continue;
      const { error } = await supabase.rpc("definir_proximo_numero", { p_tipo: tipo, p_proximo: proximo });
      if (error) return { ok: false, erro: `${tipo === "recibo" ? "Recibo" : "Orçamento"}: ${error.message}` };
    }
    const { error } = await supabase
      .from("regras_orcamento")
      .update({ validade_padrao_dias: p.validadeDias, prazo_entrega_padrao: p.prazoEntrega, condicoes_padrao: p.condicoes })
      .eq("id", true);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/configuracoes");
    return { ok: true, mensagem: "Numeração e padrões salvos · valem para os próximos" };
  } catch (e) {
    return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
  }
}
