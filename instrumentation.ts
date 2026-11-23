/**
 * Erros do servidor viram uma linha JSON no log (na VPS: `docker compose logs app`). Vai o padrão da rota
 * (/o/[token]), não o endereço pedido, e nada dos cabeçalhos: o endereço do orçamento tem o token da cliente e
 * os cabeçalhos têm o cookie da sessão.
 */
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = (erro, pedido, contexto) => {
  const e = erro instanceof Error ? erro : new Error(String(erro));
  const digest = typeof erro === "object" && erro !== null && "digest" in erro ? String(erro.digest) : undefined;
  console.error(
    JSON.stringify({
      nivel: "erro",
      em: new Date().toISOString(),
      metodo: pedido.method,
      rota: contexto.routePath,
      tipo: contexto.routeType,
      mensagem: e.message,
      digest,
      pilha: e.stack?.split("\n").slice(0, 6).join("\n"),
    }),
  );
};
