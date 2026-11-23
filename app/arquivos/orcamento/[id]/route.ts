/** PDF do orçamento para a gestora (qualquer situação; rascunho sai marcado como rascunho). */
import { obterSessao } from "@/lib/auth";
import { gerarOrcamentoPdf } from "@/lib/impressos/orcamento";
import { type DocumentoOrcamento, nomeArquivoOrcamento } from "@/lib/vendas/documento";
import { criarClienteServidor } from "@/lib/supabase/server";
import { VERSAO } from "@/lib/versao";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessao();
  if (!sessao) return new Response("Faça login.", { status: 401 });
  if (sessao.papel !== "gestora") return new Response("Sem permissão.", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Endereço inválido.", { status: 400 });

  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("documento_orcamento", { p_id: id });
  if (!data) return new Response("Orçamento não encontrado.", { status: 404 });
  const doc = data as unknown as DocumentoOrcamento;
  const nome = nomeArquivoOrcamento(doc);
  return new Response(new Uint8Array(await gerarOrcamentoPdf(doc, VERSAO)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
