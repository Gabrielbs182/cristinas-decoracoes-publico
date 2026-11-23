import type { Metadata } from "next";

import { TituloPortal } from "@/components/portal/titulo";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { dataBr, diaMes, duracao, somarDias } from "@/lib/ponto";
import { semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus espelhos" };

export default async function MeusEspelhos() {
  const sessao = await exigirPapel("funcionaria");
  const supabase = await criarClienteServidor();
  const [atual, { data: fechadas }] = await Promise.all([
    semanaPadrao(supabase),
    supabase
      .from("semana_resultados")
      .select("segunda, trabalhadas_min, espelho_path, semanas(fechada_em)")
      .eq("funcionaria_id", sessao.funcionariaId!)
      .order("segunda", { ascending: false })
      .limit(60),
  ]);
  const aberta = !fechadas?.some((s) => s.segunda === atual);
  const periodo = (segunda: string) => `${diaMes(segunda)} a ${dataBr(somarDias(segunda, 4))}`;

  return (
    <>
      <TituloPortal contexto="Um PDF por semana" titulo="Meus espelhos" />
      <div className="text-[13px] text-pretty text-tinta-3">O espelho de cada semana fica disponível depois que a gestora fecha a semana.</div>
      {aberta ? (
        <div className="flex items-center justify-between gap-2 rounded-[14px] border border-dashed border-tracejado bg-superficie px-4 py-3.5">
          <div className="flex flex-col">
            <b className="text-[15px]">{periodo(atual)}</b>
            <span className="text-[13px] text-tinta-3">Semana em aberto</span>
          </div>
          <Selo tom="atencao" icone="relogio">
            Aguardando
          </Selo>
        </div>
      ) : null}
      {(fechadas ?? []).map((s) => {
        const fechadaEm = s.semanas?.fechada_em;
        const detalhe = `${duracao(s.trabalhadas_min)}${fechadaEm ? ` · fechada em ${new Date(fechadaEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}` : ""}`;
        return s.espelho_path ? (
          <a
            key={s.segunda}
            href={`/arquivos/espelho/${s.segunda}/${sessao.funcionariaId}`}
            target="_blank"
            className="flex min-h-11 items-center justify-between gap-2 rounded-[14px] border border-borda bg-superficie px-4 py-3 text-tinta no-underline"
          >
            <div className="flex flex-col">
              <b className="text-[15px]">{periodo(s.segunda)}</b>
              <span className="text-[13px] text-tinta-3">{detalhe}</span>
            </div>
            <span className="flex h-10 items-center gap-1.5 rounded-lg border border-borda-campo px-3 text-[13px] font-extrabold">
              <span className="rounded-[3px] bg-perigo px-1 py-0.5 text-[10px] text-white">PDF</span>
              Baixar
            </span>
          </a>
        ) : (
          <div key={s.segunda} className="flex items-center justify-between gap-2 rounded-[14px] border border-borda bg-superficie px-4 py-3">
            <div className="flex flex-col">
              <b className="text-[15px]">{periodo(s.segunda)}</b>
              <span className="text-[13px] text-tinta-3">{detalhe}</span>
            </div>
            <span className="text-[13px] text-tinta-3">Sem PDF</span>
          </div>
        );
      })}
    </>
  );
}
