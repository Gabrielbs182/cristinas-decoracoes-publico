"use server";

/** Aprovação pela cliente, pelo link. Só no clique (POST): a prévia do WhatsApp abre a página mas não aprova. */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function aprovarPeloLink(entrada: { token: string }): Promise<RespostaAcao> {
  const token = z.string().uuid().safeParse(entrada.token);
  if (!token.success) return { ok: false, erro: "Link inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("aprovar_orcamento_publico", { p_token: token.data });
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/o/${token.data}`);
  revalidatePath("/orcamentos");
  revalidatePath("/inicio");
  return { ok: true, mensagem: "Orçamento aprovado. A loja vai entrar em contato." };
}
