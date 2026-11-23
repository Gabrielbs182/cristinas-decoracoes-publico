import { Check } from "lucide-react";
import Link from "next/link";

import { Cartao, EstadoVazio, Sobretitulo } from "@/components/ui/cartao";
import { dataBr, diaMes, duracao, somarDias } from "@/lib/ponto";
import type { BancoDaFuncionaria } from "@/lib/ponto/servidor";
import { cn } from "@/lib/utils";

import { FormularioAjusteSaldo } from "./ajuste-saldo";
import { GraficoBanco } from "./grafico-banco";

const sinal = (m: number) => (m > 0 ? `+${duracao(m)}` : m < 0 ? duracao(m) : "—");

export function PainelBanco({ bancos, selecionadaId, base, corteMin, toleranciaMin, ajuste }: {
  bancos: BancoDaFuncionaria[];
  selecionadaId?: string;
  base: string;
  corteMin: number;
  toleranciaMin: number;
  /** Só para a gestora: semana aberta em que o ajuste manual entra. */
  ajuste?: { semanaRotulo: string };
}) {
  const b = bancos.find((x) => x.id === selecionadaId) ?? bancos[0];
  if (!b) return <EstadoVazio icone={<Check />} titulo="Nenhuma funcionária ativa" />;
  const pagos = b.semanas.filter((s) => s.fechouCorte).length;
  const extras = b.semanas.reduce((t, s) => t + s.extrasMin, 0);
  const desde = b.semanas[0]?.segunda;

  return (
    <>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Funcionária">
        {bancos.map((f) => {
          const ativa = f.id === b.id;
          return (
            <Link
              key={f.id}
              href={`${base}?f=${f.id}`}
              role="tab"
              aria-selected={ativa}
              scroll={false}
              className={cn(
                "flex flex-col rounded-xl border px-3.5 py-2 text-left",
                ativa ? "border-tinta bg-tinta text-white" : "border-borda-campo bg-superficie text-tinta hover:bg-[#f6f1ea]",
              )}
            >
              <span className="text-[13px] font-bold">{f.nomeExibicao}</span>
              <span className={cn("text-xs", ativa ? "text-[#e6dcd0]" : "text-tinta-3")}>saldo {duracao(f.saldoAtualMin)}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            l: "Saldo atual",
            v: duracao(b.saldoAtualMin),
            d: b.ajustesPendentesMin
              ? `inclui ajuste de ${sinal(b.ajustesPendentesMin)} na semana em aberto`
              : b.fechadoAte
                ? `segue do fechamento de ${diaMes(somarDias(b.fechadoAte, 4))}`
                : "nenhuma semana fechada",
          },
          { l: "Falta para o corte", v: duracao(Math.max(0, corteMin - b.saldoAtualMin)), d: `corte ${duracao(corteMin)} · tolerância ${toleranciaMin} min` },
          { l: "Dias pagos", v: String(pagos), d: desde ? `desde ${dataBr(desde)}` : "—" },
          { l: "Extras no período", v: duracao(extras), d: `${b.semanas.length} semanas fechadas` },
        ].map((k) => (
          <Cartao key={k.l} className="flex flex-col gap-1 p-4">
            <span className="text-[13px] font-semibold text-tinta-3">{k.l}</span>
            <b className="text-[28px] leading-tight">{k.v}</b>
            <span className="text-[13px] text-tinta-3">{k.d}</span>
          </Cartao>
        ))}
      </div>

      <Cartao className="flex flex-col gap-2.5 p-4">
        <div className="flex flex-wrap justify-between gap-2.5">
          <b className="text-[15px]">Acumulado semana a semana · {b.nomeExibicao}</b>
          <span className="flex flex-wrap items-center gap-3.5 text-xs text-tinta-2">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-terracota" /> acumulado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="grid size-3.5 place-items-center rounded-full bg-sucesso text-white">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
              fechou o corte · 1 dia pago
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-tinta-2" /> hora de corte {duracao(corteMin)}
            </span>
          </span>
        </div>
        <GraficoBanco pontos={b.semanas} corteMin={corteMin} />
      </Cartao>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Cartao className="overflow-x-auto">
          <div className="border-b border-trilho px-4 py-3.5 text-[15px] font-bold">Semana a semana</div>
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="bg-suave">
                {["Semana", "Saldo anterior", "Extras", "Ajuste", "Acumulado", "Hora de corte", "Segue"].map((h) => (
                  <th key={h} className="px-3.5 py-2.5">
                    <Sobretitulo>{h}</Sobretitulo>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...b.semanas].reverse().map((s) => (
                <tr key={s.segunda} className="border-t border-trilho">
                  <td className="px-3.5 py-2.5 font-bold whitespace-nowrap">
                    {diaMes(s.segunda)} a {diaMes(somarDias(s.segunda, 4))}
                  </td>
                  <td className="px-3.5 py-2.5">{duracao(s.saldoAnteriorMin)}</td>
                  <td className="px-3.5 py-2.5">+{duracao(s.extrasMin)}</td>
                  <td className="px-3.5 py-2.5">{sinal(s.ajustesMin)}</td>
                  <td className="px-3.5 py-2.5 font-extrabold">{duracao(s.acumuladoMin)}</td>
                  <td className="px-3.5 py-2.5">
                    {s.fechouCorte ? (
                      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-sucesso-fundo pr-2 pl-1 text-xs font-extrabold whitespace-nowrap text-sucesso">
                        <span className="grid size-[15px] place-items-center rounded-full bg-sucesso text-white">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                        1 dia pago
                      </span>
                    ) : (
                      <span className="text-tinta-3">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5">{duracao(s.segueMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
        <Cartao>
          <div className="border-b border-trilho px-4 py-3.5 text-[15px] font-bold">Ajustes manuais de saldo</div>
          {ajuste ? <FormularioAjusteSaldo key={b.id} funcionariaId={b.id} nome={b.nomeExibicao} semanaRotulo={ajuste.semanaRotulo} /> : null}
          {!b.ajustes.length ? <div className="px-4 py-3.5 text-[13px] text-tinta-3">Nenhum ajuste manual.</div> : null}
          {[...b.ajustes].reverse().map((a, i) => (
            <div key={i} className="flex flex-col gap-1 border-b border-trilho px-4 py-3 text-[13px] last:border-b-0">
              <div className="flex justify-between gap-2.5">
                <b>{sinal(a.minutos)}</b>
                <span className="text-tinta-3">semana de {dataBr(a.segunda)}</span>
              </div>
              <span className="text-pretty text-tinta-2">{a.motivo}</span>
            </div>
          ))}
        </Cartao>
      </div>
    </>
  );
}
