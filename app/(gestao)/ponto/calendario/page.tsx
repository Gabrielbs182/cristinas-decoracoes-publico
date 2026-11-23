import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FormRegras, NovoFeriado, RemoverFeriado } from "@/components/equipe/calendario";
import { Cartao, CabecalhoCartao, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { dataBr, diaMes, hhmm, isoDow, SIGLA_DIA, segundaDe, somarDias } from "@/lib/ponto";
import { regrasVigentes } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendário e regras" };

const TIPO = { nacional: "Nacional", municipal: "Municipal", ponte: "Ponte", facultativo: "Facultativo" } as const;

export default async function PaginaCalendario({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPapel("gestora");
  const params = await searchParams;
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const ano = typeof params.ano === "string" && /^20\d\d$/.test(params.ano) ? Number(params.ano) : Number(hoje.slice(0, 4));
  const supabase = await criarClienteServidor();

  const [{ data: feriados }, { data: fechadas }, { data: versoes }, { data: perfis }] = await Promise.all([
    supabase.from("feriados").select("data, nome, tipo").gte("data", `${ano}-01-01`).lte("data", `${ano}-12-31`).order("data"),
    supabase.from("semanas").select("segunda").eq("status", "fechada").order("segunda", { ascending: false }),
    supabase.from("regras_ponto").select("vigente_desde, criado_por").order("vigente_desde", { ascending: false }).limit(8),
    supabase.from("perfis").select("id, nome"),
  ]);
  const autor = new Map((perfis ?? []).map((p) => [p.id, p.nome]));
  const semanasFechadas = new Set((fechadas ?? []).map((s) => s.segunda));
  // As regras salvas agora valem desde a primeira semana não fechada (o banco decide; aqui só mostra).
  const desde = fechadas?.length ? somarDias(fechadas[0]!.segunda, 7) : segundaDe(hoje);
  const r = await regrasVigentes(supabase, desde);
  const atuais = {
    cargaSegQui: hhmm(r.cargaSegQuiMin),
    cargaSex: hhmm(r.cargaSexMin),
    entradaPrevista: hhmm(r.entradaPrevistaMin),
    almocoInicioPrevisto: hhmm(r.almocoInicioPrevistoMin),
    almocoPadrao: hhmm(r.almocoPadraoMin),
    horaCorte: hhmm(r.horaCorteMin),
    toleranciaCorte: String(r.toleranciaCorteMin),
    toleranciaAtraso: String(r.toleranciaAtrasoMin),
    janelaDuplicada: String(r.janelaDuplicadaMin),
  };
  const navAno = "grid size-8 place-items-center rounded-md border border-borda-campo bg-superficie";

  return (
    <>
      <TituloPagina contexto="Ponto e RH" titulo="Calendário e regras" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Cartao className="overflow-hidden">
          <CabecalhoCartao>
            <b className="text-[15px]">Feriados {ano}</b>
            <div className="flex items-center gap-1.5">
              <Link href={`/ponto/calendario?ano=${ano - 1}`} className={navAno} aria-label="Ano anterior">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href={`/ponto/calendario?ano=${ano + 1}`} className={navAno} aria-label="Próximo ano">
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </CabecalhoCartao>
          {!feriados?.length ? <div className="px-4 py-3.5 text-sm text-tinta-3">Nenhum feriado cadastrado em {ano}.</div> : null}
          {(feriados ?? []).map((f) => {
            const travado = semanasFechadas.has(segundaDe(f.data));
            return (
              <div key={f.data} className="flex items-center gap-3 border-b border-trilho px-4 py-2.5 text-sm">
                <b className="w-20 flex-none whitespace-nowrap tabular-nums">
                  {SIGLA_DIA[isoDow(f.data)]} {diaMes(f.data)}
                </b>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 break-words">{f.nome}</span>
                  <Selo tom={f.tipo === "nacional" ? "neutro" : f.tipo === "municipal" ? "info" : "marca"} icone="estrela" className="self-center sm:ml-auto">
                    {TIPO[f.tipo as keyof typeof TIPO] ?? f.tipo}
                  </Selo>
                </div>
                <RemoverFeriado data={f.data} nome={f.nome} travado={travado} />
              </div>
            );
          })}
          <NovoFeriado ano={ano} />
          <div className="px-4 pb-3.5 text-xs text-pretty text-tinta-3">
            Dia de feriado fica fora do banco de horas; batida nele aparece com aviso. Semana fechada não muda: para mexer num feriado dela, reabra a semana.
          </div>
        </Cartao>

        <Cartao className="overflow-hidden">
          <CabecalhoCartao>
            <b className="text-[15px]">Regras de jornada</b>
          </CabecalhoCartao>
          <FormRegras
            atuais={atuais}
            vigencia={`Valem a partir da semana de ${dataBr(desde)}, a primeira ainda não fechada. Semanas fechadas guardam as regras da época e não são recalculadas.`}
          />
          {versoes?.length ? (
            <details className="border-t border-trilho">
              <summary className="cursor-pointer px-4 py-3 text-[13px] font-bold">Histórico das regras</summary>
              {versoes.map((v) => (
                <div key={v.vigente_desde} className="flex justify-between gap-3 border-t border-trilho px-4 py-2 text-[13px]">
                  <span>desde {dataBr(v.vigente_desde)}</span>
                  <span className="text-tinta-3">{(v.criado_por && autor.get(v.criado_por)) ?? "carga inicial"}</span>
                </div>
              ))}
            </details>
          ) : null}
        </Cartao>
      </div>
    </>
  );
}
