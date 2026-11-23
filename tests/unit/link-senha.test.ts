/**
 * Regressão (25/10/2026): o link da primeira gestora (scripts/producao.ts) e o do e-mail de "Esqueci minha senha"
 * saíam sem type=recovery, e a tela /auth/confirmar mostrava "Link incompleto".
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { montarLinkDeSenha } from "@/lib/link-senha";

describe("link para criar a senha", () => {
  it("leva à tela de confirmar com o token e type=recovery", () => {
    const url = new URL(montarLinkDeSenha("https://sistema.exemplo.com.br", "pkce_abc123def456"));
    expect(url.origin + url.pathname).toBe("https://sistema.exemplo.com.br/auth/confirmar");
    expect(url.searchParams.get("token_hash")).toBe("pkce_abc123def456");
    expect(url.searchParams.get("type")).toBe("recovery");
  });

  it("o e-mail de senha nova monta o mesmo endereço", () => {
    expect(readFileSync("supabase/templates/recuperar-senha.html", "utf-8")).toContain('href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery"');
  });

  it("o script da VPS usa a mesma função (não monta o link por conta própria)", () => {
    const script = readFileSync("scripts/producao.ts", "utf-8");
    expect(script).toContain("montarLinkDeSenha(");
    expect(script).not.toContain('searchParams.set("token_hash"');
  });
});
