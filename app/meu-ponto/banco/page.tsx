import type { Metadata } from "next";

import { TituloPortal } from "@/components/portal/titulo";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { diaMes, duracao, somarDias } from "@/lib/ponto";
import { carregarSemana, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meu banco de horas" };

export default async function MeuBanco() {
  const sessao = await exigirPapel("funcionaria");
  const supabase = await criarClienteServidor();
  const segunda = await semanaPadrao(supabase);
  const [semana, { data: fechadas }] = await Promise.all([
    carregarSemana(supabase, segunda, { funcionariaId: sessao.funcionariaId! }),
    supabase.from("semana_resultados").select("segunda").eq("funcionaria_id", sessao.funcionariaId!).eq("fechou_corte", true).order("segunda", { ascending: false }).limit(52),
  ]);
  const b = semana.funcionarias[0]?.resultado.banco;
  const { horaCorteMin: corte, toleranciaCorteMin: tol } = semana.regras;
  const pagos = fechadas ?? [];

  return (
    <>
      <TituloPortal contexto={`Semana de ${diaMes(segunda)} a ${diaMes(somarDias(segunda, 4))}`} titulo="Meu banco de horas" />
      {b ? (
        <>
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-borda bg-superficie px-[18px] py-5">
            <span className="text-[13px] font-bold text-tinta-3">Até a hora de corte</span>
            <div className="flex items-baseline gap-2">
              <b className="text-[40px] tracking-[-.02em]">{duracao(b.acumuladoMin)}</b>
              <span className="text-lg font-semibold text-tinta-3">de {duracao(corte)}</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-[7px] bg-trilho">
              <div
                className={cn("h-full rounded-[7px]", b.fechouCorte ? "bg-sucesso" : "bg-terracota-barra")}
                style={{ width: `${Math.min(100, (b.acumuladoMin / corte) * 100)}%` }}
              />
            </div>
            <div className="text-base font-bold text-pretty">
              {b.fechouCorte ? "Você fechou a hora de corte: ganha 1 dia pago." : `Faltam ${duracao(b.faltaParaCorteMin)} para você ganhar um dia pago.`}
            </div>
            <div className="text-[13px] text-pretty text-tinta-3">
              Quando chegar a {duracao(corte)} (com {tol} min de tolerância), você ganha 1 dia de folga paga e o que passar segue para a semana seguinte. Os valores ficam
              definitivos quando a gestora fecha a semana.
            </div>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-borda bg-superficie">
            <div className="border-b border-trilho px-4 py-3 text-sm font-extrabold">Como chegou aqui</div>
            {[
              ["Saldo da semana passada", duracao(b.saldoAnteriorMin)],
              ["Extras desta semana", `+${duracao(b.extrasSemanaMin)}`],
              ...(b.ajustesMin ? [["Ajuste da gestora", `${b.ajustesMin > 0 ? "+" : "−"}${duracao(Math.abs(b.ajustesMin))}`]] : []),
              ["Acumulado", duracao(b.acumuladoMin)],
              ["Hora de corte", duracao(corte)],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-trilho px-4 py-3 text-[15px] last:border-b-0">
                <span>{l}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div className="overflow-hidden rounded-[14px] border border-borda bg-superficie">
        <div className="border-b border-trilho px-4 py-3 text-sm font-extrabold">Dias pagos ({pagos.length})</div>
        {!pagos.length ? <div className="px-4 py-3 text-sm text-tinta-3">Nenhum ainda.</div> : null}
        {pagos.map((s) => (
          <div key={s.segunda} className="flex items-center justify-between border-b border-trilho px-4 py-3 text-[15px] last:border-b-0">
            <span>
              Semana {diaMes(s.segunda)} a {diaMes(somarDias(s.segunda, 4))}
            </span>
            <Selo tom="ok" icone="check" tamanho="g">
              1 dia pago
            </Selo>
          </div>
        ))}
      </div>
    </>
  );
}
