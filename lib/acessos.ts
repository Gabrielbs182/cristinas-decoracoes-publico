/**
 * Logins (Supabase Auth) pela API de admin: criar, gerar link de senha, bloquear. Só no servidor e só
 * depois de exigirPapel("gestora"). Perfil e cadastro continuam no banco com o RLS.
 */
import "server-only";

import { emailParaLogin, loginParaEmail } from "@/lib/auth";
import { enderecoDoSistema } from "@/lib/endereco-publico";
import { apagarFatores } from "@/lib/duas-etapas";
import { montarLinkDeSenha } from "@/lib/link-senha";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export interface UsuarioDoAuth {
  email: string;
  login: string;
  ultimoAcesso: string | null;
}

export async function usuariosDoAuth(): Promise<Map<string, UsuarioDoAuth>> {
  const { data, error } = await criarClienteAdmin().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Não deu para ler os acessos: ${error.message}`);
  return new Map(
    data.users.map((u) => [u.id, { email: u.email ?? "", login: emailParaLogin(u.email ?? ""), ultimoAcesso: u.last_sign_in_at ?? null }]),
  );
}

/** Cria o login sem senha: a pessoa define a senha pelo link. */
export async function criarLogin(login: string, nome: string): Promise<string> {
  const { data, error } = await criarClienteAdmin().auth.admin.createUser({ email: loginParaEmail(login), email_confirm: true, user_metadata: { nome } });
  if (error) {
    if (/already.*registered|exists/i.test(error.message)) throw new Error("Já existe um acesso com esse usuário. Escolha outro.");
    throw new Error(`Não deu para criar o acesso: ${error.message}`);
  }
  return data.user.id;
}

export async function apagarLogin(userId: string): Promise<void> {
  await criarClienteAdmin().auth.admin.deleteUser(userId);
}

/** Link de uso único para definir a senha (vale pelo otp_expiry do Auth: 24 h). Gerar outro invalida o anterior. */
export async function linkDeSenha(userId: string): Promise<{ link: string; login: string; duasEtapasDesligada: boolean }> {
  const admin = criarClienteAdmin();
  const { data: u, error: e1 } = await admin.auth.admin.getUserById(userId);
  if (e1 || !u.user?.email) throw new Error("Acesso não encontrado.");
  // Senha nova também desliga a verificação em duas etapas: é a saída de quem perdeu o celular (liga de novo depois).
  const duasEtapasDesligada = (await apagarFatores(admin, userId)) > 0;
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: u.user.email });
  if (error) throw new Error(`Não deu para gerar o link: ${error.message}`);
  return { link: montarLinkDeSenha(await enderecoDoSistema(), data.properties.hashed_token), login: emailParaLogin(u.user.email), duasEtapasDesligada };
}

/** Bloqueio também no Auth: derruba o login de vez (o RLS já não mostra nada para perfil inativo). */
export async function bloquearLogin(userId: string, bloquear: boolean): Promise<void> {
  const { error } = await criarClienteAdmin().auth.admin.updateUserById(userId, { ban_duration: bloquear ? "876000h" : "none" });
  if (error) throw new Error(`Não deu para ${bloquear ? "bloquear" : "desbloquear"} o login: ${error.message}`);
}
