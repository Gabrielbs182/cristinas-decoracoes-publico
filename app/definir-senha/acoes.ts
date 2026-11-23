"use server";

/**
 * Criar ou trocar a senha. Com `token_hash` (link mandado pela gestora) o link só é validado AQUI, no
 * envio do formulário: o WhatsApp abre o link sozinho para montar a prévia, e validar na abertura da
 * página gastaria o link de uso único antes de a pessoa tocar nele.
 */
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { INICIO_DO_PAPEL, obterSessao, type Papel } from "@/lib/auth";
import { supabaseChavePublica, supabaseUrl } from "@/lib/config";
import { mensagemDeEspera, tentativasPorLogin } from "@/lib/limite";
import { criarClienteServidor } from "@/lib/supabase/server";

export type RespostaSenha = { ok: true; mensagem: string; destino: string } | { ok: false; erro: string };

/** Mesma regra do Auth (config.toml: mínimo 8, letras e números), checada antes de gastar o link. */
const SENHA = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "Senha longa demais.")
  .refine((s) => /[a-zA-Z]/.test(s) && /\d/.test(s), "Use letras e números na senha.");

const TRADUCAO: [RegExp, string][] = [
  [/different from the old/i, "A senha nova precisa ser diferente da atual."],
  [/weak|characters/i, "Senha fraca: use pelo menos 8 caracteres, com letras e números."],
  [/expired|invalid/i, "Este link venceu ou já foi usado. Peça um link novo à gestora."],
  [/banned/i, "Seu acesso está bloqueado. Fale com a gestora."],
];
const traduzir = (m: string) => TRADUCAO.find(([r]) => r.test(m))?.[1] ?? m;

/**
 * A senha atual confere? Num cliente à parte, sem guardar sessão: entrar de novo aqui não mexe na sessão de quem
 * está trocando a senha.
 */
async function senhaConfere(email: string, senha: string): Promise<boolean> {
  const verificador = createClient(supabaseUrl, supabaseChavePublica, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await verificador.auth.signInWithPassword({ email, password: senha });
  return !error;
}

export async function definirSenha(entrada: { senha: string; confirmacao: string; tokenHash?: string; senhaAtual?: string }): Promise<RespostaSenha> {
  try {
    const senha = SENHA.parse(entrada.senha);
    if (senha !== entrada.confirmacao) return { ok: false, erro: "As duas senhas não são iguais." };
    const supabase = await criarClienteServidor();

    if (entrada.tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: z.string().min(10).max(200).parse(entrada.tokenHash) });
      if (error) return { ok: false, erro: traduzir(error.message) };
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { ok: false, erro: "Sua sessão acabou. Entre de novo." };
      // Trocar sem link pede a senha atual (antes, um celular desbloqueado bastava para trocar a senha da dona).
      const chave = `senha:${user.id}`;
      const espera = tentativasPorLogin.espera(chave);
      if (espera) return { ok: false, erro: mensagemDeEspera(espera) };
      if (!entrada.senhaAtual || !(await senhaConfere(user.email ?? "", entrada.senhaAtual))) {
        tentativasPorLogin.falhou(chave);
        return { ok: false, erro: "A senha atual não confere." };
      }
      tentativasPorLogin.limpar(chave);
    }

    const { data, error } = await supabase.auth.updateUser({ password: senha });
    if (error || !data.user) return { ok: false, erro: traduzir(error?.message ?? "Erro inesperado.") };

    const { data: perfil } = await supabase.from("perfis").select("papel, ativo").eq("id", data.user.id).maybeSingle();
    if (!perfil?.ativo) {
      await supabase.auth.signOut();
      return { ok: false, erro: "Seu acesso está bloqueado. Fale com a gestora." };
    }
    return { ok: true, mensagem: entrada.tokenHash ? "Senha criada · você já está dentro" : "Senha trocada", destino: INICIO_DO_PAPEL[perfil.papel as Papel] };
  } catch (e) {
    return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function alterarMeuNome(entrada: { nome: string }): Promise<RespostaAcao> {
  const sessao = await obterSessao();
  if (!sessao) return { ok: false, erro: "Sua sessão acabou. Entre de novo." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("alterar_meu_nome", { p_nome: entrada.nome });
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/", "layout"); // o nome aparece em todas as telas
  return { ok: true, mensagem: "Nome atualizado" };
}

export type RespostaInicioDuasEtapas = { ok: true; fatorId: string; qr: string; segredo: string } | { ok: false; erro: string };

/** Começa a ligar a verificação em duas etapas: devolve o QR code (e o código para digitar) do app autenticador. */
export async function iniciarDuasEtapas(): Promise<RespostaInicioDuasEtapas> {
  const sessao = await obterSessao();
  if (!sessao) return { ok: false, erro: "Sua sessão acabou. Entre de novo." };
  if (sessao.duasEtapas) return { ok: false, erro: "A verificação em duas etapas já está ligada." };
  const supabase = await criarClienteServidor();
  // Tentativa anterior que não chegou a ser confirmada: sai antes de começar outra.
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  for (const f of fatores?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Celular ${Date.now()}`, issuer: "Cristina's Decorações" });
  if (error) return { ok: false, erro: error.message };
  return { ok: true, fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}

/** Confirma com o primeiro código do app: daí em diante, o login pede o código. */
export async function confirmarDuasEtapas(entrada: { fatorId: string; codigo: string }): Promise<RespostaAcao> {
  const sessao = await obterSessao();
  if (!sessao) return { ok: false, erro: "Sua sessão acabou. Entre de novo." };
  const codigo = entrada.codigo.replace(/\D/g, "");
  if (codigo.length !== 6) return { ok: false, erro: "Digite os 6 números que aparecem no app." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: z.string().uuid().parse(entrada.fatorId), code: codigo });
  if (error) return { ok: false, erro: "Código errado ou vencido. Confira no app e tente de novo." };
  revalidatePath("/", "layout");
  return { ok: true, mensagem: "Verificação em duas etapas ligada" };
}

export async function desligarDuasEtapas(): Promise<RespostaAcao> {
  const sessao = await obterSessao();
  if (!sessao) return { ok: false, erro: "Sua sessão acabou. Entre de novo." };
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { ok: false, erro: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, mensagem: "Verificação em duas etapas desligada" };
}
