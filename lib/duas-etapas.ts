/**
 * Desliga a verificação em duas etapas de alguém (apaga os fatores do app autenticador). É a saída de quem perdeu o
 * celular: "Redefinir senha" (tela) e `scripts/producao.ts link` chamam isto junto com o link de senha nova.
 * Recebe o cliente com a chave secreta: só para tarefas de acesso, depois de conferir quem pede.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function apagarFatores(admin: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error(`Não deu para ler a verificação em duas etapas: ${error.message}`);
  for (const f of data.factors) {
    const { error: e } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (e) throw new Error(`Não deu para desligar a verificação em duas etapas: ${e.message}`);
  }
  return data.factors.length;
}
