/** Sessão e papel do usuário atual (servidor). A tela usa isto para navegar; quem protege o dado é o RLS. */
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";

export type Papel = "gestora" | "funcionaria" | "contador";

export interface Sessao {
  userId: string;
  nome: string;
  papel: Papel;
  funcionariaId: string | null;
  login: string;
  /** Verificação em duas etapas (código do app autenticador) ligada. */
  duasEtapas: boolean;
}

const DOMINIO = () => process.env.USUARIOS_DOMINIO_INTERNO ?? "usuarios.cristinas.invalid";

/** "ana.s" → "ana.s@<domínio interno>"; e-mail de verdade passa direto. */
export function loginParaEmail(login: string): string {
  const l = login.trim().toLowerCase();
  return l.includes("@") ? l : `${l}@${DOMINIO()}`;
}

/** Inverso, para exibir: usuário sem e-mail aparece só como "ana.s". */
export function emailParaLogin(email: string): string {
  const sufixo = `@${DOMINIO()}`;
  return email.endsWith(sufixo) ? email.slice(0, -sufixo.length) : email;
}

/**
 * Estado do login, uma consulta por requisição. `codigo`: entrou com a senha, mas ligou a verificação em duas
 * etapas e ainda não digitou o código — para o sistema ainda está fora (telas, arquivos e ações recusam).
 */
const estadoDoLogin = cache(async (): Promise<{ sessao: Sessao | null; faltaCodigo: boolean }> => {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sessao: null, faltaCodigo: false };
  // Os fatores vêm do usuário validado no servidor (getUser); o nível da sessão (aal), do token.
  const duasEtapas = (user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");
  if (duasEtapas) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") return { sessao: null, faltaCodigo: true };
  }
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, papel, funcionaria_id, ativo")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || !perfil.ativo) return { sessao: null, faltaCodigo: false };
  return {
    sessao: {
      userId: user.id,
      nome: perfil.nome,
      papel: perfil.papel,
      funcionariaId: perfil.funcionaria_id,
      login: emailParaLogin(user.email ?? ""),
      duasEtapas,
    },
    faltaCodigo: false,
  };
});

export const obterSessao = async (): Promise<Sessao | null> => (await estadoDoLogin()).sessao;
/** Entrou com a senha e falta o código da verificação em duas etapas. */
export const faltaCodigo = async (): Promise<boolean> => (await estadoDoLogin()).faltaCodigo;

export const INICIO_DO_PAPEL: Record<Papel, string> = {
  gestora: "/inicio",
  funcionaria: "/meu-ponto",
  contador: "/rh/semanas",
};

/** Garante sessão e papel; senão manda para o login ou para "sem permissão". */
export async function exigirPapel(...papeis: Papel[]): Promise<Sessao> {
  const { sessao, faltaCodigo: semCodigo } = await estadoDoLogin();
  if (!sessao) redirect(semCodigo ? "/login/codigo" : "/login");
  if (!papeis.includes(sessao.papel)) redirect("/sem-permissao");
  return sessao;
}
