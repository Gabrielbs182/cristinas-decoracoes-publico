/** Equipe e acessos: regras puras (sem banco), usadas nas telas e nas ações. */

/** Usuário sem e-mail: letras minúsculas, números e . _ - no meio (ex.: "ana.s"). */
export const LOGIN_VALIDO = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function loginValido(login: string): boolean {
  const l = login.trim().toLowerCase();
  if (l.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l) && l.length <= 120;
  return l.length >= 3 && l.length <= 32 && LOGIN_VALIDO.test(l);
}

/** "Bruna S" → "bruna.s"; "Ana Paula Ribeiro" → "ana.r". A gestora pode trocar. */
export function sugerirLogin(nome: string): string {
  const partes = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "";
  const ultima = partes.length > 1 ? partes.at(-1)! : "";
  return ultima ? `${partes[0]}.${ultima.slice(0, 1)}` : partes[0]!;
}

export type SituacaoAcesso = "sem_acesso" | "convite" | "ativo" | "bloqueado";

export const ROTULO_ACESSO: Record<SituacaoAcesso, string> = {
  sem_acesso: "Sem acesso",
  convite: "Convite enviado",
  ativo: "Ativo",
  bloqueado: "Bloqueado",
};

/** Convite = login criado e ainda não usado (nunca entrou). */
export function situacaoDoAcesso(perfil: { ativo: boolean } | null, usuario: { ultimoAcesso: string | null } | null): SituacaoAcesso {
  if (!perfil || !usuario) return "sem_acesso";
  if (!perfil.ativo) return "bloqueado";
  return usuario.ultimoAcesso ? "ativo" : "convite";
}

export function mensagemDeAcesso(d: { nome: string; login: string; link: string; empresa: string; primeiro: boolean }): string {
  const abertura = d.primeiro ? `Este é o seu acesso ao ponto da ${d.empresa}.` : `Este é o link para criar uma senha nova no ponto da ${d.empresa}.`;
  return [
    `Olá, ${d.nome}! ${abertura}`,
    `Seu usuário: ${d.login}`,
    `Toque no link para criar sua senha (vale por 24 horas e só funciona uma vez):`,
    d.link,
  ].join("\n");
}

/** Sem número: o WhatsApp abre para a gestora escolher a conversa. */
export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
