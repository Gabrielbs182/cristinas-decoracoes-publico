/** Endereço público do sistema, para montar links (acesso da funcionária, orçamento da cliente). */
import "server-only";

import { headers } from "next/headers";

/** Em produção vem de APP_URL (não confia no cabeçalho Host); em desenvolvimento, da própria requisição. */
export async function enderecoDoSistema(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("Configure APP_URL (endereço público do sistema) para gerar links.");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "127.0.0.1:3100"}`;
}
