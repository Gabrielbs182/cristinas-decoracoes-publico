/**
 * Para onde voltar depois do login (?volta=). Só caminho deste site: o navegador lê "/\x.com" e "/<tab>/x.com"
 * como "//x.com" (outro site), e um link "faça login de novo" que cai numa cópia falsa do login rouba a senha.
 */
const BASE = "http://interno.invalid";

export function destinoSeguro(volta: unknown): string | null {
  // Começa com uma barra só; sem barra invertida nem espaço/tab/quebra (o navegador os descarta ou troca por "/").
  if (typeof volta !== "string" || !/^\/(?![/\\])[^\s\\]*$/.test(volta)) return null;
  const url = new URL(volta, BASE);
  return url.origin === BASE ? url.pathname + url.search : null;
}
