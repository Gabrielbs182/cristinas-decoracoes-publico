/** Planilha .xlsx de uma semana fechada (gestora e contador), no layout do sistema antigo. */
import { obterSessao } from "@/lib/auth";
import { carregarFechamento } from "@/lib/impressos/dados";
import { gerarPlanilha, nomeArquivoPlanilha } from "@/lib/impressos/planilha";
import { segundaDoParametro } from "@/lib/ponto/parametros";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ segunda: string }> }) {
  const sessao = await obterSessao();
  if (!sessao) return new Response("Faça login.", { status: 401 });
  if (sessao.papel === "funcionaria") return new Response("Sem permissão.", { status: 403 });
  const segunda = segundaDoParametro((await params).segunda);
  if (!segunda) return new Response("Semana inválida.", { status: 400 });

  const supabase = await criarClienteServidor();
  const fechamento = await carregarFechamento(supabase, segunda);
  if (!fechamento) return new Response("A semana não está fechada.", { status: 404 });

  return new Response(new Uint8Array(await gerarPlanilha(fechamento)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivoPlanilha(segunda)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
