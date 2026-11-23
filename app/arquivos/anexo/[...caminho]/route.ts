/**
 * Anexo de um pedido de correção (ex.: foto do atestado). Lido do Storage com a sessão de quem pede:
 * só a própria funcionária e a gestora conseguem (dado de saúde; o contador não tem acesso).
 */
import { obterSessao } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";

const SEGMENTO = /^[0-9A-Za-z._-]+$/;

export async function GET(_: Request, { params }: { params: Promise<{ caminho: string[] }> }) {
  const sessao = await obterSessao();
  if (!sessao) return new Response("Faça login.", { status: 401 });
  const { caminho } = await params;
  if (caminho.length !== 2 || !caminho.every((s) => SEGMENTO.test(s))) return new Response("Endereço inválido.", { status: 400 });

  const supabase = await criarClienteServidor();
  const { data } = await supabase.storage.from("anexos").download(caminho.join("/"));
  if (!data) return new Response("Anexo não encontrado ou sem permissão.", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
