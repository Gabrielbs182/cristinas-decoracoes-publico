/** PDF do orçamento pelo link da cliente (sem login; o token é a chave). */
import { gerarOrcamentoPdf } from "@/lib/impressos/orcamento";
import { type DocumentoOrcamento, nomeArquivoOrcamento } from "@/lib/vendas/documento";
import { criarClienteServidor } from "@/lib/supabase/server";
import { VERSAO } from "@/lib/versao";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Link inválido.", { status: 404 });
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("orcamento_publico", { p_token: token });
  if (!data) return new Response("Orçamento não encontrado.", { status: 404 });
  if (typeof data === "object" && "expirado" in data) return new Response("Este link expirou. Fale com a loja.", { status: 404 });
  const doc = data as unknown as DocumentoOrcamento;
  return new Response(new Uint8Array(await gerarOrcamentoPdf(doc, VERSAO)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivoOrcamento(doc)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
