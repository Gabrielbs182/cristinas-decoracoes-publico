/**
 * Link para criar/trocar a senha: a tela /auth/confirmar com o token_hash do Auth e type=recovery (sem o type a
 * tela recusa: "Link incompleto"). Uma função só para a tela Equipe/Configurações (lib/acessos.ts) e para o script
 * da VPS (scripts/producao.ts); o modelo do e-mail (supabase/templates) monta o mesmo endereço.
 */
export function montarLinkDeSenha(endereco: string, tokenHash: string): string {
  const url = new URL("/auth/confirmar", endereco);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "recovery");
  return url.toString();
}
