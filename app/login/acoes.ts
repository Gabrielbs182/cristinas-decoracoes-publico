"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { emailParaLogin, INICIO_DO_PAPEL, loginParaEmail, type Papel } from "@/lib/auth";
import { destinoSeguro } from "@/lib/destino";
import { ipDe, mensagemDeEspera, tentativasPorIp, tentativasPorLogin } from "@/lib/limite";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface EstadoLogin {
  erro?: string;
  login?: string;
}

export async function entrar(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const login = String(formData.get("login") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!login || !senha) return { erro: "Preencha o usuário e a senha.", login };

  // Limite antes de ir ao Auth: na VPS ele só enxerga o IP do servidor Next, então não limita quem tenta.
  const email = loginParaEmail(login);
  const ip = `ip:${ipDe(await headers())}`;
  const espera = Math.max(tentativasPorLogin.espera(email), tentativasPorIp.espera(ip));
  if (espera) return { erro: mensagemDeEspera(espera), login };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) {
    tentativasPorLogin.falhou(email);
    tentativasPorIp.falhou(ip);
    return { erro: error && /banned/i.test(error.message) ? "Seu acesso está bloqueado. Fale com a Cristina." : "Usuário ou senha incorretos.", login };
  }
  tentativasPorLogin.limpar(email);

  const { data: perfil } = await supabase.from("perfis").select("papel, ativo").eq("id", data.user.id).maybeSingle();
  if (!perfil?.ativo) {
    await supabase.auth.signOut();
    return { erro: "Seu acesso está bloqueado. Fale com a Cristina.", login };
  }
  const volta = destinoSeguro(formData.get("volta"));
  // Verificação em duas etapas ligada: a senha certa só leva à tela do código (até lá, o sistema recusa tudo).
  if (data.user.factors?.some((f) => f.factor_type === "totp" && f.status === "verified")) {
    redirect(volta ? `/login/codigo?volta=${encodeURIComponent(volta)}` : "/login/codigo");
  }
  redirect(volta ?? INICIO_DO_PAPEL[perfil.papel as Papel]);
}

export interface EstadoCodigo {
  erro?: string;
}

/** Segunda etapa: o código de 6 dígitos do app autenticador. Mesmo limite do login (5 erros em 15 min). */
export async function verificarCodigo(_: EstadoCodigo, formData: FormData): Promise<EstadoCodigo> {
  const codigo = String(formData.get("codigo") ?? "").replace(/\D/g, "");
  if (codigo.length !== 6) return { erro: "Digite os 6 números que aparecem no app." };
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const chave = `codigo:${user.id}`;
  const espera = tentativasPorLogin.espera(chave);
  if (espera) return { erro: mensagemDeEspera(espera) };
  const fator = user.factors?.find((f) => f.factor_type === "totp" && f.status === "verified");
  if (!fator) redirect("/login");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
  if (error) {
    tentativasPorLogin.falhou(chave);
    return { erro: "Código errado ou vencido. Confira no app e tente de novo." };
  }
  tentativasPorLogin.limpar(chave);
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).maybeSingle();
  redirect(destinoSeguro(formData.get("volta")) ?? (perfil ? INICIO_DO_PAPEL[perfil.papel as Papel] : "/login"));
}

/**
 * "Esqueci minha senha" de quem entra com e-mail: o Auth manda o link (modelo em supabase/templates). A resposta é
 * sempre a mesma, exista ou não o e-mail (não revela quem tem acesso). Limite: 5 pedidos por e-mail em 15 min.
 */
export async function pedirLinkPorEmail(login: string): Promise<{ mensagem: string }> {
  const email = loginParaEmail(login);
  if (!email.includes("@") || emailParaLogin(email) !== email) return { mensagem: "Esse usuário não tem e-mail: fale com a Cristina para receber um link novo." };
  const chave = `email:${email}`;
  const ip = `ip:${ipDe(await headers())}`;
  const espera = Math.max(tentativasPorLogin.espera(chave), tentativasPorIp.espera(ip));
  if (espera) return { mensagem: mensagemDeEspera(espera) };
  tentativasPorLogin.falhou(chave); // aqui conta cada pedido, não só erro: segura quem quer encher a caixa de alguém
  tentativasPorIp.falhou(ip);
  const supabase = await criarClienteServidor();
  await supabase.auth.resetPasswordForEmail(email);
  return { mensagem: "Se este e-mail tiver acesso, mandamos um link para criar uma senha nova. Confira a caixa de entrada e o spam." };
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
