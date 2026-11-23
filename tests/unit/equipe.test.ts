/** Equipe e acessos: usuário, situação do acesso e a mensagem do convite. */
import { describe, expect, it } from "vitest";

import { linkWhatsApp, loginValido, mensagemDeAcesso, situacaoDoAcesso, sugerirLogin } from "@/lib/equipe";

describe("usuário de acesso", () => {
  it("sugere primeiro nome + inicial do último, sem acento", () => {
    expect(sugerirLogin("Bruna S")).toBe("bruna.s");
    expect(sugerirLogin("Ana Paula Ribeiro")).toBe("ana.r");
    expect(sugerirLogin("Cláudia")).toBe("claudia");
    expect(sugerirLogin("Elaine 1")).toBe("elaine.1");
    expect(sugerirLogin("  ")).toBe("");
  });

  it("aceita usuário curto ou e-mail; recusa o resto", () => {
    for (const ok of ["ana.s", "bruna_s", "joana-m2", "ana@gmail.com"]) expect(loginValido(ok), ok).toBe(true);
    for (const ruim of ["an", "ana..s", ".ana", "ana s", "Ána", "ana@", "a".repeat(33)]) expect(loginValido(ruim), ruim).toBe(false);
  });
});

describe("situação do acesso", () => {
  it("sem perfil → sem acesso; bloqueado vence; nunca entrou → convite", () => {
    expect(situacaoDoAcesso(null, null)).toBe("sem_acesso");
    expect(situacaoDoAcesso({ ativo: false }, { ultimoAcesso: "2026-10-01T10:00:00Z" })).toBe("bloqueado");
    expect(situacaoDoAcesso({ ativo: true }, { ultimoAcesso: null })).toBe("convite");
    expect(situacaoDoAcesso({ ativo: true }, { ultimoAcesso: "2026-10-01T10:00:00Z" })).toBe("ativo");
  });
});

describe("mensagem do convite", () => {
  const link = "http://127.0.0.1:3100/auth/confirmar?token_hash=abc&type=recovery";

  it("leva usuário, link e prazo; o link do WhatsApp codifica o texto", () => {
    const texto = mensagemDeAcesso({ nome: "Bruna", login: "bruna.s", link, empresa: "Cristina's Decorações", primeiro: true });
    expect(texto).toContain("Olá, Bruna! Este é o seu acesso ao ponto da Cristina's Decorações.");
    expect(texto).toContain("Seu usuário: bruna.s");
    expect(texto).toContain("24 horas");
    expect(texto.endsWith(link)).toBe(true);
    expect(decodeURIComponent(linkWhatsApp(texto).split("?text=")[1]!)).toBe(texto);
  });

  it("redefinição fala de senha nova", () => {
    expect(mensagemDeAcesso({ nome: "Ana", login: "ana.s", link, empresa: "X", primeiro: false })).toContain("criar uma senha nova");
  });
});
