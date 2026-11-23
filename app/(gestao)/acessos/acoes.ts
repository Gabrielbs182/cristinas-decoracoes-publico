"use server";

/**
 * Acessos ao sistema: criar login (funcionária, gestora ou contador), gerar link de senha e bloquear.
 * O login mora no Auth (API de admin, só aqui no servidor); o perfil, no banco, criado com a sessão da
 * gestora (criar_perfil) — se o perfil falhar, o login recém-criado é desfeito.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { apagarLogin, bloquearLogin, criarLogin, linkDeSenha } from "@/lib/acessos";
import { exigirPapel } from "@/lib/auth";
import { linkWhatsApp, loginValido, mensagemDeAcesso } from "@/lib/equipe";
import { criarClienteServidor } from "@/lib/supabase/server";

export type RespostaLink = { ok: true; mensagem: string; link: string; texto: string; whatsapp: string } | { ok: false; erro: string };

const UUID = z.string().uuid();

function falhou(e: unknown): { ok: false; erro: string } {
  return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
}

function revalidar() {
  revalidatePath("/ponto/equipe");
  revalidatePath("/configuracoes");
}

async function comLink(userId: string, nome: string, primeiro: boolean, mensagem: string): Promise<RespostaLink> {
  const supabase = await criarClienteServidor();
  const [{ link, login, duasEtapasDesligada }, { data: empresa }] = await Promise.all([linkDeSenha(userId), supabase.from("empresa").select("nome_fantasia").maybeSingle()]);
  const texto = mensagemDeAcesso({ nome: nome.split(" ")[0]!, login, link, empresa: empresa?.nome_fantasia || "Cristina's Decorações", primeiro });
  return { ok: true, mensagem: duasEtapasDesligada ? `${mensagem} · verificação em duas etapas desligada` : mensagem, link, texto, whatsapp: linkWhatsApp(texto) };
}

const NOVO_ACESSO = z.discriminatedUnion("papel", [
  z.object({ papel: z.literal("funcionaria"), funcionariaId: UUID, login: z.string() }),
  z.object({ papel: z.enum(["gestora", "contador"]), nome: z.string().trim().min(2, "Informe o nome.").max(60), login: z.string() }),
]);

export async function criarAcesso(entrada: z.input<typeof NOVO_ACESSO>): Promise<RespostaLink> {
  try {
    await exigirPapel("gestora");
    const e = NOVO_ACESSO.parse(entrada);
    const login = e.login.trim().toLowerCase();
    if (!loginValido(login)) return { ok: false, erro: "Usuário inválido: use letras minúsculas, números e ponto (ex.: ana.s) ou um e-mail." };
    const supabase = await criarClienteServidor();

    let nome: string;
    if (e.papel === "funcionaria") {
      const { data: f } = await supabase.from("funcionarias").select("nome_exibicao, ativa").eq("id", e.funcionariaId).maybeSingle();
      if (!f?.ativa) return { ok: false, erro: "Funcionária não encontrada ou inativa." };
      const { count } = await supabase.from("perfis").select("id", { count: "exact", head: true }).eq("funcionaria_id", e.funcionariaId);
      if (count) return { ok: false, erro: "Essa funcionária já tem acesso." };
      nome = f.nome_exibicao;
    } else {
      nome = e.nome;
    }

    const userId = await criarLogin(login, nome);
    const { error } = await supabase.rpc("criar_perfil", {
      p_usuario: userId,
      p_nome: nome,
      p_papel: e.papel,
      // O gerador de tipos não marca argumento de função como anulável; o banco aceita null.
      p_funcionaria: (e.papel === "funcionaria" ? e.funcionariaId : null) as string,
    });
    if (error) {
      await apagarLogin(userId);
      return { ok: false, erro: error.message };
    }
    revalidar();
    return await comLink(userId, nome, true, "Acesso criado · mande o link para a pessoa");
  } catch (e) {
    return falhou(e);
  }
}

/** Primeiro acesso que se perdeu, ou senha esquecida: link novo (o anterior deixa de valer). */
export async function novoLinkDeSenha(entrada: { userId: string }): Promise<RespostaLink> {
  try {
    await exigirPapel("gestora");
    const userId = UUID.parse(entrada.userId);
    const supabase = await criarClienteServidor();
    const { data: p } = await supabase.from("perfis").select("nome, ativo").eq("id", userId).maybeSingle();
    if (!p) return { ok: false, erro: "Acesso não encontrado." };
    if (!p.ativo) return { ok: false, erro: "O acesso está bloqueado. Desbloqueie antes de gerar o link." };
    revalidar();
    return await comLink(userId, p.nome, false, "Link novo gerado · o anterior não vale mais");
  } catch (e) {
    return falhou(e);
  }
}

export async function bloquearAcesso(entrada: { userId: string; bloquear: boolean }): Promise<RespostaAcao> {
  try {
    const sessao = await exigirPapel("gestora");
    const userId = UUID.parse(entrada.userId);
    if (userId === sessao.userId) return { ok: false, erro: "Você não pode bloquear o seu próprio acesso." };
    const supabase = await criarClienteServidor();
    if (entrada.bloquear) {
      // Perfil primeiro: o banco garante que sempre sobra uma gestora; depois o Auth derruba o login.
      const { data, error } = await supabase.from("perfis").update({ ativo: false }).eq("id", userId).select("id");
      if (error) return { ok: false, erro: error.message };
      if (!data?.length) return { ok: false, erro: "Acesso não encontrado." };
      await bloquearLogin(userId, true);
    } else {
      await bloquearLogin(userId, false);
      const { error } = await supabase.from("perfis").update({ ativo: true }).eq("id", userId);
      if (error) return { ok: false, erro: error.message };
    }
    revalidar();
    return { ok: true, mensagem: entrada.bloquear ? "Acesso bloqueado" : "Acesso desbloqueado" };
  } catch (e) {
    return falhou(e);
  }
}
