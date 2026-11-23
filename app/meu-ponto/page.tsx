import { AlertTriangle, ChevronLeft, ChevronRight, ChevronRight as Seta } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { rotuloSemana } from "@/components/ponto/barra-semana";
import { SeloSituacao } from "@/components/ponto/selo-situacao";
import { TituloPortal } from "@/components/portal/titulo";
import { estilosBotao } from "@/components/ui/botao";
import { exigirPapel } from "@/lib/auth";
import { diaMes, duracao, hhmm, SIGLA_DIA, somarDias } from "@/lib/ponto";
import { segundaDoParametro } from "@/lib/ponto/parametros";
import { carregarSemana, pendenciasAbertasDaFuncionaria, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meu ponto" };

export default async function MeuPonto({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sessao = await exigirPapel("funcionaria");
  const supabase = await criarClienteServidor();
  const segunda = segundaDoParametro((await searchParams).s) ?? (await semanaPadrao(supabase));
  // O RLS já limita às linhas dela; o filtro só evita carregar o que não é usado.
  const [semana, pendencias] = await Promise.all([
    carregarSemana(supabase, segunda, { funcionariaId: sessao.funcionariaId! }),
    pendenciasAbertasDaFuncionaria(supabase, sessao.funcionariaId!),
  ]);
  const r = semana.funcionarias[0]?.resultado;
  const dias = r?.dias.filter((d) => d.dow <= 5 || d.batidas.length) ?? [];
  const abertas = pendencias.filter((p) => !p.pedidoEnviado);
  const b = r?.banco;
  const corte = semana.regras.horaCorteMin;
  const nav = "grid size-11 place-items-center rounded-lg bg-[#f6f1ea]";

  return (
    <>
      <TituloPortal titulo="Meu ponto" />
      {abertas.length ? (
        <Link href="/meu-ponto/pendencias" className="flex min-h-11 items-center gap-3 rounded-xl bg-perigo-fundo p-3.5 text-[#7e1c2b]">
          <AlertTriangle className="size-5 flex-none text-perigo" />
          <span className="flex-1 text-sm font-bold text-pretty">
            {abertas.length === 1 ? "Você tem 1 pendência. Toque para resolver." : `Você tem ${abertas.length} pendências. Toque para resolver.`}
          </span>
          <Seta className="size-5" />
        </Link>
      ) : null}

      <div className="flex items-center gap-2 rounded-xl border border-borda bg-superficie p-1.5">
        <Link href={`/meu-ponto?s=${somarDias(segunda, -7)}`} className={nav} aria-label="Semana anterior">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex flex-1 flex-col text-center">
          <b className="text-[15px]">{rotuloSemana(segunda)}</b>
          <span className="text-xs text-tinta-3">
            {r ? `${duracao(r.trabalhadasMin)} trabalhadas` : ""} · {semana.status === "fechada" ? "semana fechada" : "em aberto"}
          </span>
        </div>
        <Link href={`/meu-ponto?s=${somarDias(segunda, 7)}`} className={nav} aria-label="Próxima semana">
          <ChevronRight className="size-5" />
        </Link>
      </div>

      {!semana.temBatidas ? (
        <div className="rounded-xl border border-dashed border-tracejado bg-superficie p-6 text-center text-sm text-tinta-3">Sem batidas nesta semana.</div>
      ) : (
        dias.map((d) => {
          const horas = d.batidas.filter((x) => x.tipo && !x.excedente).map((x) => x.hora);
          return (
            <div
              key={d.data}
              className={cn("flex flex-col gap-2 rounded-xl border bg-superficie px-3.5 py-3", d.situacao === "pendencia" ? "border-perigo-borda" : "border-borda")}
            >
              <div className="flex items-center justify-between gap-2">
                <b className="text-[15px]">
                  {SIGLA_DIA[d.dow]} {diaMes(d.data)}
                </b>
                <b className="text-lg">{d.trabalhadasMin !== null && !d.foraDoCalculo ? hhmm(d.trabalhadasMin) : "—"}</b>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] tracking-[.02em] text-tinta-2">{horas.join(" · ") || d.feriado || "sem batidas"}</span>
                <SeloSituacao situacao={d.situacao} />
              </div>
            </div>
          );
        })
      )}

      {b ? (
        <Link href="/meu-ponto/banco" className="flex items-center gap-3 rounded-xl border border-borda bg-superficie px-3.5 py-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-bold text-tinta-3">Banco de horas</span>
            <div className="h-2 overflow-hidden rounded bg-trilho">
              <div className={cn("h-full", b.fechouCorte ? "bg-sucesso" : "bg-terracota-barra")} style={{ width: `${Math.min(100, (b.acumuladoMin / corte) * 100)}%` }} />
            </div>
          </div>
          <b className="text-[15px] whitespace-nowrap">
            {duracao(b.acumuladoMin)} <span className="font-semibold text-tinta-3">de {duracao(corte)}</span>
          </b>
          <Seta className="size-5 text-tinta-3" />
        </Link>
      ) : null}

      {semana.status !== "fechada" ? (
        <Link href="/meu-ponto/corrigir" className={estilosBotao({ variante: "secundario", tamanho: "g", className: "font-extrabold" })}>
          Pedir correção de uma batida
        </Link>
      ) : null}
    </>
  );
}
