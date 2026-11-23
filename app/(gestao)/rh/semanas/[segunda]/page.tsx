import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { rotuloSemana } from "@/components/ponto/barra-semana";
import { SeloSituacao } from "@/components/ponto/selo-situacao";
import { estilosBotao } from "@/components/ui/botao";
import { Cartao, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { diaMes, duracao, hhmm, isoDow, SIGLA_DIA, type Situacao } from "@/lib/ponto";
import { segundaDoParametro } from "@/lib/ponto/parametros";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Espelho da semana" };

const SITUACOES: Situacao[] = ["ok", "pendencia", "aviso", "ajustado", "falta", "atestado", "falta_justificada", "folga", "feriado", "sem_jornada"];

/** Espelho de uma semana fechada, montado da fotografia gravada no fechamento. */
export default async function EspelhoSemana({ params }: { params: Promise<{ segunda: string }> }) {
  const sessao = await exigirPapel("contador", "gestora");
  const segunda = segundaDoParametro((await params).segunda);
  if (!segunda) notFound();
  const supabase = await criarClienteServidor();
  const [{ data: semana }, { data: resultados }, { data: dias }, { data: funcionarias }] = await Promise.all([
    supabase.from("semanas").select("status, fechada_em").eq("segunda", segunda).maybeSingle(),
    supabase.from("semana_resultados").select("*").eq("segunda", segunda),
    supabase.from("semana_resultado_dias").select("*").eq("segunda", segunda).order("data"),
    supabase.from("funcionarias").select("id, nome_exibicao").order("nome_exibicao"),
  ]);
  if (semana?.status !== "fechada" || !resultados?.length) notFound();

  const ordem = (funcionarias ?? []).filter((f) => resultados.some((r) => r.funcionaria_id === f.id));

  return (
    <>
      <TituloPagina contexto={<Link href="/rh/semanas" className="text-terracota">‹ Semanas fechadas</Link>} titulo={`Semana ${rotuloSemana(segunda)}`}>
        {sessao.papel === "gestora" ? (
          <Link href={`/ponto/fechamento?s=${segunda}`} className={estilosBotao({ variante: "secundario" })}>
            Fechamento
          </Link>
        ) : null}
        <a href={`/arquivos/planilha/${segunda}`} className={estilosBotao()}>
          <Download /> Planilha .xlsx
        </a>
      </TituloPagina>
      <div className="text-[13px] text-tinta-3">
        Fechada em {semana.fechada_em ? new Date(semana.fechada_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}. Valores oficiais do fechamento.
      </div>

      {ordem.map((f) => {
        const r = resultados.find((x) => x.funcionaria_id === f.id)!;
        const delas = (dias ?? []).filter((d) => d.funcionaria_id === f.id);
        return (
          <Cartao key={f.id} className="overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilho px-4 py-3.5">
              <span className="flex items-center gap-3">
                <b className="font-display text-[19px] font-medium">{f.nome_exibicao}</b>
                {r.espelho_path ? (
                  <a href={`/arquivos/espelho/${segunda}/${f.id}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-[13px] font-bold text-terracota">
                    <span className="rounded-[3px] bg-perigo px-1 py-0.5 text-[10px] font-extrabold text-white">PDF</span>
                    Espelho
                  </a>
                ) : null}
              </span>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                <span>
                  Saldo anterior <b>{duracao(r.saldo_anterior_min)}</b>
                </span>
                <span>
                  Extras <b>+{duracao(r.extras_semana_min)}</b>
                </span>
                {r.ajustes_min ? (
                  <span>
                    Ajuste <b>{r.ajustes_min > 0 ? "+" : ""}{duracao(r.ajustes_min)}</b>
                  </span>
                ) : null}
                <span>
                  Acumulado <b>{duracao(r.acumulado_min)}</b>
                </span>
                <span className={r.fechou_corte ? "font-bold text-sucesso" : ""}>{r.fechou_corte ? "✓ 1 dia pago" : "Não fechou o corte"}</span>
                <span>
                  Segue <b>{duracao(r.proxima_semana_min)}</b>
                </span>
              </div>
            </div>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="bg-suave">
                  {["Dia", "Entrada", "Saída almoço", "Volta almoço", "Saída", "Trabalhadas", "Extras", "Situação"].map((h) => (
                    <th key={h} className="px-3.5 py-2">
                      <Sobretitulo>{h}</Sobretitulo>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {delas.map((d) => (
                  <tr key={d.data} className="border-t border-trilho">
                    <td className="px-3.5 py-2 font-bold whitespace-nowrap">
                      {SIGLA_DIA[isoDow(d.data)]} {diaMes(d.data)}
                    </td>
                    {[d.entrada, d.saida_almoco, d.volta_almoco, d.saida].map((h, i) => (
                      <td key={i} className="px-3.5 py-2">
                        {h ?? <span className="text-tinta-4">—</span>}
                      </td>
                    ))}
                    <td className="px-3.5 py-2">{d.trabalhadas_min === null ? "Falta" : hhmm(d.trabalhadas_min)}</td>
                    <td className="px-3.5 py-2">{d.extra_min ? `+${duracao(d.extra_min)}` : "—"}</td>
                    <td className="px-3.5 py-2">
                      <SeloSituacao situacao={SITUACOES.includes(d.situacao as Situacao) ? (d.situacao as Situacao) : "ok"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        );
      })}
    </>
  );
}
