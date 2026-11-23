/** Geração e envio dos espelhos de uma semana fechada (servidor, com a sessão da gestora). */
import "server-only";

import type { ClienteSupabase } from "@/lib/supabase/server";
import { VERSAO } from "@/lib/versao";

import { caminhoEspelho } from "@/lib/ponto/fechamento";

import { carregarFechamento } from "./dados";
import { gerarEspelhoPdf } from "./espelho";

/**
 * Gera o PDF de cada funcionária da semana e envia para o bucket `espelhos`.
 * `apenasFaltantes`: não toca no que já existe (preserva, por exemplo, os PDFs do sistema antigo).
 */
export async function gerarEspelhosDaSemana(
  supabase: ClienteSupabase,
  segunda: string,
  opcoes: { apenasFaltantes?: boolean } = {},
): Promise<{ gerados: number; falhas: string[] }> {
  const f = await carregarFechamento(supabase, segunda);
  if (!f) throw new Error("A semana não está fechada.");
  let gerados = 0;
  const falhas: string[] = [];
  for (const fu of f.funcionarias) {
    const caminho = caminhoEspelho(fu.id, segunda);
    if (opcoes.apenasFaltantes) {
      const { data } = await supabase.storage.from("espelhos").list(fu.id, { search: `${segunda}.pdf` });
      if (data?.some((o) => o.name === `${segunda}.pdf`)) continue;
    }
    try {
      const pdf = await gerarEspelhoPdf({ empresa: f.empresa, segunda, fechadaEm: f.fechadaEm, regras: f.regras, funcionaria: fu, versao: VERSAO });
      const { error } = await supabase.storage.from("espelhos").upload(caminho, pdf, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error(error.message);
      await supabase.from("semana_resultados").update({ espelho_path: caminho }).eq("segunda", segunda).eq("funcionaria_id", fu.id);
      gerados++;
    } catch (e) {
      falhas.push(`${fu.nome}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { gerados, falhas };
}
