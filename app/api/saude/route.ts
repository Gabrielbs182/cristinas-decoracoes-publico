/**
 * Saúde do sistema, para o monitoramento da VPS (sem login): o app responde e alcança o Auth, o banco (PostgREST)
 * e os arquivos (Storage) do Supabase. 200 se tudo responde, 503 se algo caiu. Não devolve dado nenhum do negócio.
 */
import { supabaseChavePublica, supabaseUrl } from "@/lib/config";
import { VERSAO } from "@/lib/versao";

async function responde(caminho: string, corpo?: object): Promise<boolean> {
  try {
    const r = await fetch(`${supabaseUrl}${caminho}`, {
      method: corpo ? "POST" : "GET",
      headers: { apikey: supabaseChavePublica, "Content-Type": "application/json" },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Banco: uma das duas funções liberadas ao anônimo, com um token que não existe (devolve null). 200 = PostgREST e
// Postgres respondendo. Regressão (ensaio da VPS, 25/10/2026): a raiz /rest/v1/ é bloqueada ao anônimo no gateway do
// Supabase oficial, e a saúde dava "banco: false" com tudo de pé.
const BANCO = { caminho: "/rest/v1/rpc/orcamento_publico", corpo: { p_token: "00000000-0000-0000-0000-000000000000" } };

export async function GET() {
  const [auth, banco, arquivos] = await Promise.all([responde("/auth/v1/health"), responde(BANCO.caminho, BANCO.corpo), responde("/storage/v1/status")]);
  const ok = auth && banco && arquivos;
  return Response.json({ ok, versao: VERSAO, auth, banco, arquivos }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
