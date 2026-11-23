import { AlertTriangle, Check, Lock, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BarraSemana, contagens } from "@/components/ponto/barra-semana";
import { DetalheDia } from "@/components/ponto/detalhe-dia";
import { LEGENDA, SeloSituacao } from "@/components/ponto/selo-situacao";
import { Botao, estilosBotao } from "@/components/ui/botao";
import { Cartao, EstadoVazio, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { dataBr, diaMes, duracao, hhmm, SIGLA_DIA, somarDias } from "@/lib/ponto";
import { historicoDoDia } from "@/lib/ponto/historico";
import { diaDoParametro, segundaDoParametro } from "@/lib/ponto/parametros";
import { carregarSemana, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Semana" };

export default async function PaginaSemana({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPapel("gestora");
  const params = await searchParams;
  const supabase = await criarClienteServidor();
  const segunda = segundaDoParametro(params.s) ?? (await semanaPadrao(supabase));
  const [semana, { count: solicitacoes }] = await Promise.all([
    carregarSemana(supabase, segunda),
    supabase.from("solicitacoes_correcao").select("id", { count: "exact", head: true }).eq("status", "pendente"),
  ]);
  const { bloqueios, etapa } = contagens(semana);
  const fechada = semana.status === "fechada";

  // Sábado e domingo só aparecem se alguém bateu ponto neles.
  const colunas = [0, 1, 2, 3, 4, 5, 6].filter((i) => i < 5 || semana.funcionarias.some((f) => f.resultado.dias[i]!.batidas.length));
  const urlSemana = `/ponto/semana?s=${segunda}`;

  const aberto = diaDoParametro(params.d);
  const fAberta = aberto && semana.funcionarias.find((f) => f.id === aberto.funcionariaId);
  const diaAberto = fAberta && fAberta.resultado.dias.find((d) => d.data === aberto.data);

  return (
    <>
      <TituloPagina contexto="Ponto e RH" titulo="Semana">
        {fechada ? (
          <span className="text-[13px] text-tinta-3">Semana fechada{semana.fechadaEm ? ` em ${dataBr(semana.fechadaEm.slice(0, 10))}` : ""}.</span>
        ) : (
          <span className="max-w-[300px] text-right text-[13px] text-tinta-3">
            {bloqueios === 1
              ? "Fechar fica disponível quando a pendência que bloqueia for resolvida."
              : bloqueios
                ? `Fechar fica disponível quando as ${bloqueios} pendências que bloqueiam forem resolvidas.`
                : semana.temBatidas
                  ? "Tudo certo para fechar."
                  : ""}
          </span>
        )}
        <Link href="/ponto/importar" className={estilosBotao({ variante: "secundario" })}>
          Importar arquivo
        </Link>
        {etapa === "pronta" && semana.temBatidas ? (
          <Link href={`/ponto/fechamento?s=${segunda}`} className={estilosBotao()}>
            Fechar semana
          </Link>
        ) : !fechada ? (
          <Botao disabled>Fechar semana</Botao>
        ) : null}
      </TituloPagina>

      <BarraSemana semana={semana} base="/ponto/semana" solicitacoes={solicitacoes ?? 0} />

      {fechada ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] bg-neutro-fundo px-4 py-3 text-sm">
          <Lock className="size-4 text-neutro" />
          <span className="flex-1">
            <b>Semana fechada.</b> Os valores do banco são os oficiais do fechamento; o dia abre só para consulta.
          </span>
          <Link href={`/ponto/fechamento?s=${segunda}`} className="font-bold text-terracota">
            Espelhos e planilha ›
          </Link>
        </div>
      ) : null}

      {semana.idsDesconhecidos.length ? (
        <Link
          href={`/ponto/pendencias?s=${segunda}`}
          className="flex flex-wrap items-center gap-3 rounded-[10px] border border-perigo-borda bg-[#fdf3f4] px-4 py-3 text-sm"
        >
          <AlertTriangle className="size-4 text-perigo" />
          <span className="flex-1">
            <b>{semana.idsDesconhecidos.length} ID(s) da catraca sem funcionária</b> ({semana.idsDesconhecidos.map((i) => i.enNo.replace(/^0+/, "")).join(", ")}). Vincule ou ignore
            para poder fechar a semana.
          </span>
          <span className="font-bold text-terracota">Resolver ›</span>
        </Link>
      ) : null}

      {!semana.temBatidas ? (
        <EstadoVazio
          icone={<Upload />}
          titulo="Nenhuma batida nesta semana"
          acao={
            <Link href="/ponto/importar" className={estilosBotao({ tamanho: "g" })}>
              Importar arquivo da catraca
            </Link>
          }
        >
          Importe o arquivo da catraca para ver as horas de {diaMes(segunda)} a {diaMes(somarDias(segunda, 4))}. O mesmo arquivo pode ser importado de novo sem duplicar batidas.
        </EstadoVazio>
      ) : (
        <>
          <Cartao className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-suave">
                  <th className="px-4 py-3">
                    <Sobretitulo>Funcionária</Sobretitulo>
                  </th>
                  {colunas.map((i) => {
                    const d = somarDias(segunda, i);
                    const carga = semana.funcionarias[0]?.resultado.dias[i]?.cargaMin ?? 0;
                    return (
                      <th key={i} className="border-l border-trilho px-3 py-3 align-top">
                        <Sobretitulo>
                          {SIGLA_DIA[i + 1]} {diaMes(d)}
                        </Sobretitulo>
                        <div className="text-xs font-semibold text-tinta-3">{semana.feriados[d] ?? (carga ? `carga ${duracao(carga)}` : "—")}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {semana.funcionarias.map((f) => (
                  <tr key={f.id} className="border-t border-trilho">
                    <th scope="row" className="px-4 py-3 align-middle font-normal">
                      <div className="text-sm font-bold">{f.nomeExibicao}</div>
                      <div className="text-xs text-tinta-3">
                        ID {f.enNo?.replace(/^0+/, "") ?? "—"} · semana {duracao(f.resultado.trabalhadasMin)}
                      </div>
                    </th>
                    {colunas.map((i) => {
                      const d = f.resultado.dias[i]!;
                      const vazio = !d.batidas.length && (d.situacao === "sem_jornada");
                      return (
                        <td key={i} className={cn("border-l border-trilho p-0 align-top", vazio && "bg-[#faf8f4]")}>
                          {vazio ? null : (
                            <Link
                              href={`${urlSemana}&d=${f.id}_${d.data}`}
                              scroll={false}
                              className="flex min-h-[76px] flex-col gap-1.5 px-3 py-2.5 hover:bg-[#fbf6ef]"
                              aria-label={`${f.nomeExibicao}, ${diaMes(d.data)}: abrir o dia`}
                            >
                              <span className="flex items-baseline gap-1.5">
                                <span className="text-[17px] font-bold">{d.trabalhadasMin !== null ? hhmm(d.trabalhadasMin) : "—"}</span>
                                {d.extraMin > 0 ? <span className="text-xs text-tinta-3">+{duracao(d.extraMin)}</span> : null}
                                {d.foraDoCalculo ? <span className="text-xs text-tinta-3">fora do banco</span> : null}
                              </span>
                              <SeloSituacao situacao={d.situacao} />
                            </Link>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>

          <div className="flex flex-wrap items-center gap-3.5 text-xs text-tinta-3">
            <span className="font-bold">Legenda</span>
            {LEGENDA.map((s) => (
              <SeloSituacao key={s} situacao={s} />
            ))}
            <span>· Clique em um dia para ver o detalhe.</span>
          </div>
        </>
      )}

      {semana.funcionarias.length ? (
          <Cartao className="overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilho px-4 py-3.5">
              <div className="font-display text-[19px] font-medium">{semana.temBatidas || fechada ? "Banco de horas da semana" : "Saldo atual do banco de horas"}</div>
              <div className="text-[13px] text-tinta-3">
                Hora de corte {duracao(semana.regras.horaCorteMin)} · tolerância {semana.regras.toleranciaCorteMin} min · ao fechar, 1 dia pago e o excedente segue
              </div>
            </div>
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="bg-suave">
                  {["Funcionária", "Saldo anterior", "Extras da semana", "Acumulado", "Falta p/ corte", `Hora de corte (${duracao(semana.regras.horaCorteMin)})`, "Segue"].map((h) => (
                    <th key={h} className="px-3 py-2.5">
                      <Sobretitulo>{h}</Sobretitulo>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semana.funcionarias.map((f) => {
                  const b = f.resultado.banco;
                  const pct = Math.min(100, Math.max(0, (b.acumuladoMin / semana.regras.horaCorteMin) * 100));
                  return (
                    <tr key={f.id} className="border-t border-trilho text-[15px]">
                      <td className="px-3 py-3 text-sm font-bold">{f.nomeExibicao}</td>
                      <td className="px-3 py-3">
                        {duracao(b.saldoAnteriorMin)}
                        {f.saldoProvisorio ? <span className="ml-1 text-xs text-atencao">provisório</span> : null}
                      </td>
                      <td className="px-3 py-3">
                        +{duracao(b.extrasSemanaMin)}
                        {b.ajustesMin ? <span className="ml-1 text-xs text-tinta-3">(ajuste {b.ajustesMin > 0 ? "+" : ""}{duracao(b.ajustesMin)})</span> : null}
                      </td>
                      <td className="px-3 py-3 font-extrabold">{duracao(b.acumuladoMin)}</td>
                      <td className="px-3 py-3">{b.fechouCorte ? "—" : duracao(b.faltaParaCorteMin)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 min-w-16 flex-1 overflow-hidden rounded bg-trilho">
                            <div className={cn("h-full", b.fechouCorte ? "bg-sucesso" : "bg-terracota-barra")} style={{ width: `${pct}%` }} />
                          </div>
                          {b.fechouCorte ? (
                            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-sucesso pr-2.5 pl-1 text-xs font-extrabold whitespace-nowrap text-white">
                              <span className="grid size-4 place-items-center rounded-full bg-white text-sucesso">
                                <Check className="size-2.5" strokeWidth={3} />
                              </span>
                              Fechou o corte · 1 dia pago
                            </span>
                          ) : (
                            <span className="text-xs whitespace-nowrap text-tinta-3">{f.resultado.provisoria ? "provisório" : `${Math.round(pct)}% do corte`}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-bold">{duracao(b.proximaSemanaMin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Cartao>
      ) : null}

      {fAberta && diaAberto ? (
        <DetalheDia
          funcionaria={{ id: fAberta.id, nome: fAberta.nome }}
          dia={diaAberto}
          historico={historicoDoDia(fAberta.lancamentos.filter((l) => l.data === diaAberto.data), diaAberto)}
          editavel={!fechada}
          urlFechar={urlSemana}
        />
      ) : null}
    </>
  );
}
