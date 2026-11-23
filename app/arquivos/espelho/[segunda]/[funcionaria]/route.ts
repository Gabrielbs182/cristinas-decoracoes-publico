/**
 * Download do espelho de ponto em PDF. Lido do Storage com a sessão de quem pede: as policies do
 * bucket decidem (gestora e contador: todos; funcionária: só a pasta dela).
 */
import { obterSessao } from "@/lib/auth";
import { nomeArquivoEspelho } from "@/lib/impressos/espelho";
import { caminhoEspelho } from "@/lib/ponto/fechamento";
import { segundaDoParametro } from "@/lib/ponto/parametros";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ segunda: string; funcionaria: string }> }) {
  const sessao = await obterSessao();
  if (!sessao) return new Response("Faça login.", { status: 401 });
  const { segunda: s, funcionaria } = await params;
  const segunda = segundaDoParametro(s);
  if (!segunda || !/^[0-9a-f-]{36}$/i.test(funcionaria)) return new Response("Endereço inválido.", { status: 400 });

  const supabase = await criarClienteServidor();
  const [{ data: arquivo }, { data: f }] = await Promise.all([
    supabase.storage.from("espelhos").download(caminhoEspelho(funcionaria, segunda)),
    supabase.from("funcionarias").select("nome_exibicao").eq("id", funcionaria).maybeSingle(),
  ]);
  if (!arquivo) return new Response("Espelho não encontrado ou sem permissão.", { status: 404 });

  const nome = nomeArquivoEspelho(f?.nome_exibicao ?? "funcionaria", segunda);
  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
