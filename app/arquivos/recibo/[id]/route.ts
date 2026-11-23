/** PDF do recibo (gestora e contador). ?vias=1 para uma via só; padrão: duas vias na mesma folha. */
import { obterSessao } from "@/lib/auth";
import { gerarReciboPdf, nomeArquivoRecibo } from "@/lib/impressos/recibo";
import { carregarDocumentoRecibo } from "@/lib/vendas/recibos-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { VERSAO } from "@/lib/versao";

export async function GET(pedido: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessao();
  if (!sessao) return new Response("Faça login.", { status: 401 });
  if (sessao.papel === "funcionaria") return new Response("Sem permissão.", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Endereço inválido.", { status: 400 });

  const supabase = await criarClienteServidor();
  const doc = await carregarDocumentoRecibo(supabase, id);
  if (!doc) return new Response("Recibo não encontrado.", { status: 404 });
  const vias = new URL(pedido.url).searchParams.get("vias") === "1" ? 1 : 2;
  return new Response(new Uint8Array(await gerarReciboPdf(doc, vias, VERSAO)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivoRecibo(doc.numero)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
