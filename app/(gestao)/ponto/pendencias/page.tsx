import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BarraSemana, rotuloSemana } from "@/components/ponto/barra-semana";
import { CartaoIdDesconhecido } from "@/components/ponto/id-desconhecido";
import { AcoesPendencia } from "@/components/ponto/pendencia";
import { CaixaSelecao, ProvedorSelecao } from "@/components/ponto/selecao-pendencias";
import { Cartao, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { diaMes, SIGLA_DIA } from "@/lib/ponto";
import { historicoDoDia } from "@/lib/ponto/historico";
import { segundaDoParametro } from "@/lib/ponto/parametros";
import { carregarSemana, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pendências" };

export default async function PaginaPendencias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPapel("gestora");
  const params = await searchParams;
  const supabase = await criarClienteServidor();
  const segunda = segundaDoParametro(params.s) ?? (await semanaPadrao(supabase));
  const filtro = params.f === "bloqueia" || params.f === "aviso" ? params.f : "todas";
  const quem = typeof params.p === "string" ? params.p : "";

  const [semana, { data: semId }, { count: solicitacoes }] = await Promise.all([
    carregarSemana(supabase, segunda),
    supabase.from("funcionarias").select("id, nome_exibicao").eq("ativa", true).is("en_no", null).order("nome_exibicao"),
    supabase.from("solicitacoes_correcao").select("id", { count: "exact", head: true }).eq("status", "pendente"),
  ]);

  const todas = semana.funcionarias.flatMap((f) => f.resultado.dias.flatMap((d) => d.pendencias.map((p) => ({ f, d, p }))));
  const visiveis = todas.filter((x) => (filtro === "todas" || x.p.severidade === filtro) && (!quem || x.f.id === quem));
  const grupos = [
    { sev: "bloqueia" as const, rotulo: "Bloqueiam o fechamento", desc: "Batida faltando, sequência que não fecha ou ID desconhecido.", itens: visiveis.filter((x) => x.p.severidade === "bloqueia") },
    { sev: "aviso" as const, rotulo: "Avisos", desc: "Não bloqueiam. Revise e confirme.", itens: visiveis.filter((x) => x.p.severidade === "aviso") },
  ].filter((g) => g.itens.length);
  // Trilha da semana: tudo que a gestora lançou (sugestões aceitas, ajustes, confirmações, justificativas).
  const diario = semana.funcionarias
    .flatMap((f) => f.resultado.dias.flatMap((d) => historicoDoDia(f.lancamentos.filter((l) => l.data === d.data), d).map((h) => ({ f, d, h }))))
    .sort((a, b) => b.h.id - a.h.id);
  const mostrarIds = filtro !== "aviso" && !quem;
  const chave = (fid: string, data: string, codigo: string) => `${fid}|${data}|${codigo}`;
  // Só entra na seleção em lote o que tem sugestão aplicável (o resto precisa de decisão caso a caso).
  const selecionaveis = visiveis
    .filter((x) => x.p.sugestao.acoes.length)
    .map((x) => ({ chave: chave(x.f.id, x.d.data, x.p.codigo), funcionariaId: x.f.id, data: x.d.data, codigo: x.p.codigo, titulo: x.p.titulo }));

  const link = (mudar: Record<string, string>) => {
    const q = new URLSearchParams({ s: segunda, ...(filtro !== "todas" && { f: filtro }), ...(quem && { p: quem }), ...mudar });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    return `/ponto/pendencias?${q}`;
  };
  const chip = (ativo: boolean) =>
    cn("h-9 rounded-full border px-3.5 text-[13px] font-bold inline-flex items-center", ativo ? "border-tinta bg-tinta text-white" : "border-borda-campo bg-superficie text-tinta");

  return (
    <>
      <TituloPagina contexto={`Ponto e RH · Semana ${rotuloSemana(segunda)}`} titulo="Pendências">
        <Link href={link({ f: "" })} className={chip(filtro === "todas")}>
          Todas
        </Link>
        <Link href={link({ f: "bloqueia" })} className={chip(filtro === "bloqueia")}>
          Bloqueiam
        </Link>
        <Link href={link({ f: "aviso" })} className={chip(filtro === "aviso")}>
          Avisos
        </Link>
      </TituloPagina>

      <BarraSemana semana={semana} base="/ponto/pendencias" solicitacoes={solicitacoes ?? 0} />

      <div className="flex flex-wrap gap-1.5 text-[13px]">
        <span className="py-1.5 font-semibold text-tinta-3">Funcionária:</span>
        <Link href={link({ p: "" })} className={cn("rounded-md px-2.5 py-1.5", !quem ? "bg-terracota-claro font-bold text-terracota-escuro" : "hover:bg-[#f6f1ea]")}>
          Todas
        </Link>
        {semana.funcionarias.map((f) => (
          <Link key={f.id} href={link({ p: f.id })} className={cn("rounded-md px-2.5 py-1.5", quem === f.id ? "bg-terracota-claro font-bold text-terracota-escuro" : "hover:bg-[#f6f1ea]")}>
            {f.nomeExibicao}
          </Link>
        ))}
      </div>

      {mostrarIds
        ? semana.idsDesconhecidos.map((id) => (
            <CartaoIdDesconhecido key={id.enNo} id={id} semVinculo={(semId ?? []).map((f) => ({ id: f.id, nome: f.nome_exibicao }))} />
          ))
        : null}

      {!grupos.length && !(mostrarIds && semana.idsDesconhecidos.length) ? (
        <Cartao className="flex flex-col items-center gap-2.5 px-6 py-11 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-sucesso-fundo text-sucesso">
            <Check className="size-6" />
          </div>
          <div className="font-display text-[22px] font-medium">Nada para revisar</div>
          <div className="text-sm text-tinta-3">{semana.temBatidas ? "Todas as pendências deste filtro foram resolvidas." : "Esta semana ainda não tem batidas importadas."}</div>
        </Cartao>
      ) : null}

      <ProvedorSelecao itens={selecionaveis}>
        {grupos.map((g) => (
          <section key={g.sev} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <Selo tom={g.sev === "bloqueia" ? "perigo" : "atencao"} icone="alerta">
                {g.rotulo} ({g.itens.length})
              </Selo>
              <span className="text-[13px] text-tinta-3">{g.desc}</span>
            </div>
            {g.itens.map(({ f, d, p }) => (
              <Cartao key={`${f.id}${d.data}${p.codigo}`} className="grid gap-x-3.5 gap-y-2 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <CaixaSelecao chave={chave(f.id, d.data, p.codigo)} />
                    <b className="text-[15px]">{p.titulo}</b>
                    <span className="text-[13px] text-tinta-3">
                      {f.nomeExibicao} · {SIGLA_DIA[d.dow]?.toLowerCase()} {diaMes(d.data)}
                    </span>
                  </div>
                  <div className="text-sm text-pretty text-tinta-2">{p.descricao}</div>
                  <div className="flex items-center gap-2 self-start rounded-lg bg-suave px-2.5 py-2 text-[13px]">
                    <span className="font-extrabold text-terracota">Sugestão</span>
                    <span>{p.sugestao.texto}</span>
                  </div>
                </div>
                <div className="md:max-w-[380px]">
                  <AcoesPendencia p={p} funcionariaId={f.id} data={d.data} linkDia={`/ponto/semana?s=${segunda}&d=${f.id}_${d.data}`} />
                </div>
              </Cartao>
            ))}
          </section>
        ))}
      </ProvedorSelecao>

      <details className="rounded-xl border border-borda bg-superficie">
        <summary className="cursor-pointer px-4 py-3.5 text-sm font-bold">Ajustes e resoluções desta semana ({diario.length})</summary>
        {diario.map(({ f, d, h }) => (
          <div key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-trilho px-4 py-2.5 text-[13px]">
            {h.desfeito ? (
              <Selo tom="neutro" icone="x">
                Desfeito
              </Selo>
            ) : (
              <Selo tom="ok" icone="check">
                Feito
              </Selo>
            )}
            <b className={cn(h.desfeito && "text-tinta-4 line-through")}>{h.texto}</b>
            <span className="text-tinta-3">
              {f.nomeExibicao} · {diaMes(d.data)}
            </span>
            <span className="min-w-40 flex-1 text-tinta-2 italic">{h.motivo}</span>
            <span className="text-tinta-3">
              {h.quem} · {h.quando}
            </span>
            <Link href={`/ponto/semana?s=${segunda}&d=${f.id}_${d.data}`} className="font-bold text-terracota">
              Ver o dia
            </Link>
          </div>
        ))}
      </details>
    </>
  );
}
