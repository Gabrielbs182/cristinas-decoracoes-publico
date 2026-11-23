/**
 * Cliente com a chave secreta: IGNORA o RLS. Só para o que o usuário não pode fazer por conta
 * própria — criar login, redefinir senha. Nunca use para ler ou gravar dados de negócio.
 */
import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "@/lib/config";

export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("Variável de ambiente ausente: SUPABASE_SECRET_KEY.");
  return createClient(supabaseUrl, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
