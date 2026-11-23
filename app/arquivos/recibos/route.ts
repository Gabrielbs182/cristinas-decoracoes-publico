/** Recibos do mês em .xlsx (gestora e contador). ?mes=2026-10 ou ?mes=todos. */
import { obterSessao } from "@/lib/auth";
import { gerarPlanilhaRecibos, nomeArquivoRecibos } from "@/lib/impressos/recibos-planilha";
import { carregarRecibos, mesDoParametro, mesPorExtenso } from "@/lib/vendas/recibos-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function GET(pedido: Request) {
  const sessao = await obterSessao();
  if (!sessao) return new Response("Faça login.", { status: 401 });
  if (sessao.papel === "funcionaria") return new Response("Sem permissão.", { status: 403 });
  const mes = mesDoParametro(new URL(pedido.url).searchParams.get("mes"));

  const supabase = await criarClienteServidor();
  const [recibos, { data: empresa }] = await Promise.all([carregarRecibos(supabase, mes), supabase.from("empresa").select("nome_fantasia").maybeSingle()]);
  const planilha = await gerarPlanilhaRecibos(recibos, mesPorExtenso(mes), empresa?.nome_fantasia || "Cristina's Decorações");
  return new Response(new Uint8Array(planilha), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivoRecibos(mes)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
