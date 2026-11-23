/**
 * Modelo do e-mail de "Esqueci minha senha", para o Auth do Supabase da VPS buscar (GOTRUE_MAILER_TEMPLATES_RECOVERY
 * aponta para cá; ele só aceita modelo por endereço http). Público e sem dado nenhum: é o mesmo arquivo que o
 * Supabase local usa (supabase/templates/recuperar-senha.html).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const html = await readFile(path.join(process.cwd(), "supabase", "templates", "recuperar-senha.html"), "utf-8");
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
