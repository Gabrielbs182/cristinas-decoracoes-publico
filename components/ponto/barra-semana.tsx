import { Check, ChevronLeft, ChevronRight, Circle, Square } from "lucide-react";
import Link from "next/link";

import { diaMes, somarDias } from "@/lib/ponto";
import type { SemanaCarregada } from "@/lib/ponto/servidor";
import { cn } from "@/lib/utils";

export function rotuloSemana(segunda: string) {
  const sexta = somarDias(segunda, 4);
  return `${diaMes(segunda)} a ${diaMes(sexta)}/${sexta.slice(0, 4)}`;
}

export function contagens(s: SemanaCarregada) {
  const bloqueios = s.funcionarias.reduce((n, f) => n + f.resultado.bloqueios, 0) + s.idsDesconhecidos.length;
  const avisos = s.funcionarias.reduce((n, f) => n + f.resultado.avisos, 0);
  // Semana sem batida não está "pronta": ainda falta importar o arquivo da catraca.
  const etapa: "aberta" | "pronta" | "fechada" = s.status === "fechada" ? "fechada" : bloqueios || !s.temBatidas ? "aberta" : "pronta";
  return { bloqueios, avisos, etapa };
}

export function BarraSemana({ semana, base, solicitacoes = 0 }: { semana: SemanaCarregada; base: string; solicitacoes?: number }) {
  const { bloqueios, avisos, etapa } = contagens(semana);
  const ordem = ["aberta", "pronta", "fechada"] as const;
  const atual = ordem.indexOf(etapa);
  const passos = [
    { l: "Aberta", Icone: Circle, cor: "bg-atencao" },
    { l: "Pronta para fechar", Icone: Check, cor: "bg-sucesso" },
    { l: "Fechada", Icone: Square, cor: "bg-tinta" },
  ];
  const nav = "grid size-9 place-items-center rounded-lg border border-borda-campo bg-superficie text-tinta hover:bg-[#f6f1ea]";

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-borda bg-superficie px-3.5 py-2.5">
      <div className="flex items-center gap-1.5">
        <Link href={`${base}?s=${somarDias(semana.segunda, -7)}`} className={nav} aria-label="Semana anterior">
          <ChevronLeft className="size-4" />
        </Link>
        <div className="min-w-[180px] text-center text-[15px] font-bold">{rotuloSemana(semana.segunda)}</div>
        <Link href={`${base}?s=${somarDias(semana.segunda, 7)}`} className={nav} aria-label="Próxima semana">
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Situação da semana">
        {passos.map(({ l, Icone, cor }, i) => {
          const ativo = i === atual;
          const feito = i < atual;
          return (
            <div key={l} className="flex items-center gap-1.5">
              <div
                aria-current={ativo ? "step" : undefined}
                className={cn(
                  "flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold",
                  ativo ? cn(cor, "border-transparent text-white") : feito ? "border-sucesso-fundo bg-sucesso-fundo text-sucesso" : "border-borda bg-superficie text-tinta-3",
                )}
              >
                {feito ? <Check className="size-3.5" /> : <Icone className="size-3.5" />}
                {l}
              </div>
              {i < 2 ? <span className="text-[#a89c90]">→</span> : null}
            </div>
          );
        })}
      </div>
      {semana.temBatidas && etapa !== "fechada" ? (
        <div className="ml-auto flex flex-wrap gap-1.5 text-[13px]">
          <Link href={`/ponto/pendencias?s=${semana.segunda}&f=bloqueia`} className="rounded-md px-2.5 py-1.5 hover:bg-[#f6f1ea]">
            <b className="text-perigo">{bloqueios}</b> {bloqueios === 1 ? "bloqueia" : "bloqueiam"} o fechamento
          </Link>
          <Link href={`/ponto/pendencias?s=${semana.segunda}&f=aviso`} className="rounded-md px-2.5 py-1.5 hover:bg-[#f6f1ea]">
            <b className="text-atencao">{avisos}</b> {avisos === 1 ? "aviso" : "avisos"}
          </Link>
          <Link href="/ponto/solicitacoes" className="rounded-md px-2.5 py-1.5 hover:bg-[#f6f1ea]">
            <b className="text-info">{solicitacoes}</b> {solicitacoes === 1 ? "solicitação" : "solicitações"}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
