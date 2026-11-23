import type { Metadata } from "next";

import { Cartao, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { dataBr } from "@/lib/ponto";
import { criarClienteServidor } from "@/lib/supabase/server";

import { Importador } from "./importador";

export const metadata: Metadata = { title: "Importar arquivo" };

export default async function PaginaImportar() {
  await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const [{ data: historico }, { data: semId }] = await Promise.all([
    supabase
      .from("importacoes")
      .select("id, arquivo_nome, importado_em, periodo_inicio, periodo_fim, batidas_novas, batidas_repetidas")
      .order("importado_em", { ascending: false })
      .limit(10),
    supabase.from("funcionarias").select("id, nome_exibicao").eq("ativa", true).is("en_no", null).order("nome_exibicao"),
  ]);

  return (
    <div className="flex max-w-[980px] flex-col gap-4">
      <TituloPagina contexto="Ponto e RH" titulo="Importar arquivo da catraca" />
      <Importador funcionariasSemId={(semId ?? []).map((f) => ({ id: f.id, nome: f.nome_exibicao }))} />
      <Cartao className="overflow-x-auto">
        <div className="border-b border-trilho px-4 py-3 text-sm font-bold">Importações anteriores</div>
        {!historico?.length ? <div className="px-4 py-3.5 text-sm text-tinta-3">Nenhum arquivo importado ainda.</div> : null}
        {historico?.length ? (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="bg-suave">
                {["Arquivo", "Quando", "Período", "Batidas"].map((h) => (
                  <th key={h} className="px-4 py-2.5">
                    <Sobretitulo>{h}</Sobretitulo>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.id} className="border-t border-trilho">
                  <td className="px-4 py-2.5 font-mono text-[13px]">{h.arquivo_nome}</td>
                  <td className="px-4 py-2.5">{new Date(h.importado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</td>
                  <td className="px-4 py-2.5">{h.periodo_inicio && h.periodo_fim ? `${dataBr(h.periodo_inicio)} a ${dataBr(h.periodo_fim)}` : "—"}</td>
                  <td className="px-4 py-2.5">
                    {h.batidas_novas} novas{h.batidas_repetidas ? ` · ${h.batidas_repetidas} repetidas` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Cartao>
    </div>
  );
}
