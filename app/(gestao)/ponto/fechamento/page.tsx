import { AlertTriangle, Check, Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BarraSemana, contagens, rotuloSemana } from "@/components/ponto/barra-semana";
import { BotaoFecharSemana, BotaoGerarEspelhos, BotaoReabrirSemana } from "@/components/ponto/fechamento-acoes";
import { estilosBotao } from "@/components/ui/botao";
import { Cartao, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { carregarFechamento } from "@/lib/impressos/dados";
import { dataBr, duracao, somarDias } from "@/lib/ponto";
import { impedimentosDoFechamento } from "@/lib/ponto/fechamento";
import { segundaDoParametro } from "@/lib/ponto/parametros";
import { carregarSemana, semanaAbertaAnterior, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Fechamento" };

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function ItemChecklist({ ok, suave, titulo, detalhe, acao }: { ok: boolean; suave?: boolean; titulo: string; detalhe: string; acao?: { href: string; rotulo: string } }) {
  return (
    <div className="flex items-center gap-3 border-b border-trilho px-4 py-3.5 last:border-b-0">
      <span className={cn("grid size-[26px] flex-none place-items-center rounded-full text-white", ok ? "bg-sucesso" : suave ? "bg-atencao" : "bg-perigo")}>
        {ok ? <Check className="size-3.5" strokeWidth={3} /> : <AlertTriangle className="size-3.5" />}
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <b className="text-sm">{titulo}</b>
        <span className="text-[13px] text-tinta-3">{detalhe}</span>
      </div>
      {!ok && acao ? (
        <Link href={acao.href} className={estilosBotao({ variante: "secundario", tamanho: "p" })}>
          {acao.rotulo}
        </Link>
      ) : null}
    </div>
  );
}

export default async function PaginaFechamento({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const segunda = segundaDoParametro((await searchParams).s) ?? (await semanaPadrao(supabase));
  const fim = somarDias(segunda, 6);

  const [semana, anterior, { count: solicitacoes }, { data: eventos }, { data: perfis }, { count: posterioresFechadas }, { data: ultimaImportacao }] = await Promise.all([
    carregarSemana(supabase, segunda),
    semanaAbertaAnterior(supabase, segunda),
    supabase.from("solicitacoes_correcao").select("id", { count: "exact", head: true }).eq("status", "pendente").gte("data", segunda).lte("data", fim),
    supabase.from("semana_eventos").select("acao, motivo, autor, em").eq("segunda", segunda).order("em", { ascending: false }),
    supabase.from("perfis").select("id, nome"),
    supabase.from("semanas").select("segunda", { count: "exact", head: true }).eq("status", "fechada").gt("segunda", segunda),
    supabase.from("importacoes").select("importado_em").lte("periodo_inicio", fim).gte("periodo_fim", segunda).order("importado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const fechada = semana.status === "fechada";
  const fechamento = fechada ? await carregarFechamento(supabase, segunda) : null;
  const { bloqueios, avisos } = contagens(semana);
  const nome = new Map((perfis ?? []).map((p) => [p.id, p.nome]));
  const impedimentos = impedimentosDoFechamento({
    temBatidas: semana.temBatidas,
    status: semana.status,
    bloqueios: bloqueios - semana.idsDesconhecidos.length,
    idsDesconhecidos: semana.idsDesconhecidos.length,
    solicitacoesPendentes: solicitacoes ?? 0,
    semanaAbertaAnterior: anterior,
  });
  const rotulo = rotuloSemana(segunda);
  const faltamEspelhos = fechamento?.funcionarias.some((f) => !f.resultado.espelho_path);

  // Resumo: o oficial (fotografia) se fechada; o calculado agora se aberta.
  const resumo = fechamento
    ? fechamento.funcionarias.map((f) => ({
        id: f.id,
        nome: f.nome,
        dias: f.resultado.dias_trabalhados,
        horas: f.resultado.trabalhadas_min,
        extras: f.resultado.extras_semana_min,
        acumulado: f.resultado.acumulado_min,
        fechou: f.resultado.fechou_corte,
        segue: f.resultado.proxima_semana_min,
        espelho: !!f.resultado.espelho_path,
      }))
    : semana.funcionarias.map((f) => ({
        id: f.id,
        nome: f.nomeExibicao,
        dias: f.resultado.diasTrabalhados,
        horas: f.resultado.trabalhadasMin,
        extras: f.resultado.banco.extrasSemanaMin,
        acumulado: f.resultado.banco.acumuladoMin,
        fechou: f.resultado.banco.fechouCorte,
        segue: f.resultado.banco.proximaSemanaMin,
        espelho: false,
      }));

  return (
    <>
      <TituloPagina contexto={`Ponto e RH · Semana ${rotulo}`} titulo="Fechamento da semana" />
      <BarraSemana semana={semana} base="/ponto/fechamento" solicitacoes={solicitacoes ?? 0} />

      {fechada ? (
        <Cartao className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-sucesso text-white">
              <Check className="size-5" strokeWidth={3} />
            </span>
            <div className="flex flex-col">
              <b className="text-[17px]">Semana fechada e travada</b>
              <span className="text-[13px] text-tinta-3">
                {semana.fechadaEm ? `Fechada em ${quando(semana.fechadaEm)}.` : ""} Os valores abaixo são os oficiais do fechamento.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {resumo.map((f) =>
              f.espelho ? (
                <a
                  key={f.id}
                  href={`/arquivos/espelho/${segunda}/${f.id}`}
                  target="_blank"
                  rel="noopener"
                  className="flex h-10 items-center gap-2 rounded-lg border border-borda-campo bg-suave px-3 text-[13px] font-bold hover:bg-[#f6f1ea]"
                >
                  <span className="rounded-[3px] bg-perigo px-1 py-0.5 text-[10px] font-extrabold text-white">PDF</span>
                  Espelho · {f.nome}
                </a>
              ) : (
                <span key={f.id} className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-tracejado px-3 text-[13px] text-tinta-3">
                  <FileText className="size-4" /> {f.nome}: espelho não gerado
                </span>
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a href={`/arquivos/planilha/${segunda}`} className={estilosBotao()}>
              <Download /> Planilha .xlsx
            </a>
            {faltamEspelhos ? <BotaoGerarEspelhos segunda={segunda} /> : null}
            {!posterioresFechadas ? <BotaoReabrirSemana segunda={segunda} rotulo={rotulo} /> : null}
          </div>
          {posterioresFechadas ? (
            <span className="text-xs text-tinta-3">Para reabrir esta semana, reabra antes as semanas fechadas depois dela (só a última fechada pode ser reaberta).</span>
          ) : null}
        </Cartao>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Cartao>
            <div className="border-b border-trilho px-4 py-3.5 text-[15px] font-bold">Checklist</div>
            <ItemChecklist
              ok={semana.temBatidas}
              titulo="Arquivo da catraca importado"
              detalhe={semana.temBatidas ? (ultimaImportacao ? `Última importação em ${quando(ultimaImportacao.importado_em)}` : "Batidas da semana carregadas") : "Nenhuma batida nesta semana"}
              acao={{ href: "/ponto/importar", rotulo: "Importar" }}
            />
            <ItemChecklist
              ok={!anterior}
              titulo="Semana anterior fechada"
              detalhe={anterior ? `A semana de ${dataBr(anterior)} ainda está aberta: o saldo dela é o ponto de partida desta` : "O saldo anterior já é oficial"}
              acao={anterior ? { href: `/ponto/fechamento?s=${anterior}`, rotulo: "Ir para ela" } : undefined}
            />
            <ItemChecklist
              ok={bloqueios === 0}
              titulo="Pendências que bloqueiam"
              detalhe={bloqueios ? `${bloqueios} ainda aberta(s)` : "Todas resolvidas"}
              acao={{ href: `/ponto/pendencias?s=${segunda}&f=bloqueia`, rotulo: "Resolver" }}
            />
            <ItemChecklist
              ok={!solicitacoes}
              titulo="Solicitações das funcionárias"
              detalhe={solicitacoes ? `${solicitacoes} aguardando resposta` : "Nenhuma aguardando"}
              acao={{ href: "/ponto/solicitacoes", rotulo: "Responder" }}
            />
            <ItemChecklist
              ok={avisos === 0}
              suave
              titulo="Avisos revisados (não bloqueia)"
              detalhe={avisos ? `${avisos} aviso(s) sem revisão` : "Todos revisados"}
              acao={{ href: `/ponto/pendencias?s=${segunda}&f=aviso`, rotulo: "Revisar" }}
            />
          </Cartao>
          <Cartao className="flex flex-col gap-3 p-4">
            <b className="text-[15px]">Ao confirmar</b>
            <ul className="flex flex-col gap-1.5 text-[13px] text-tinta-2">
              <li>· A semana fica travada para edição.</li>
              <li>· Gera o espelho de ponto em PDF de cada funcionária.</li>
              <li>· Libera a planilha .xlsx da semana.</li>
              <li>· Os saldos seguem para a semana de {dataBr(somarDias(segunda, 7))}.</li>
            </ul>
            <BotaoFecharSemana segunda={segunda} rotulo={rotulo} funcionarias={semana.funcionarias.length} impedimentos={impedimentos} />
          </Cartao>
        </div>
      )}

      <Cartao className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-suave">
              {["Funcionária", "Dias trabalhados", "Horas", "Extras", "Acumulado", "Hora de corte"].map((h) => (
                <th key={h} className="px-4 py-2.5">
                  <Sobretitulo>{h}</Sobretitulo>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumo.map((f) => (
              <tr key={f.id} className="border-t border-trilho">
                <td className="px-4 py-3 font-bold">{f.nome}</td>
                <td className="px-4 py-3">{f.dias}</td>
                <td className="px-4 py-3">{duracao(f.horas)}</td>
                <td className="px-4 py-3">+{duracao(f.extras)}</td>
                <td className="px-4 py-3 font-extrabold">{duracao(f.acumulado)}</td>
                <td className={cn("px-4 py-3 text-[13px] font-bold", f.fechou ? "text-sucesso" : "text-tinta-3")}>
                  {f.fechou ? `1 dia pago · segue ${duracao(f.segue)}` : `Segue ${duracao(f.segue)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>

      {eventos?.length ? (
        <Cartao>
          <div className="border-b border-trilho px-4 py-3.5 text-[15px] font-bold">Histórico desta semana</div>
          {eventos.map((ev, i) => (
            <div key={i} className="flex flex-wrap gap-x-3 border-b border-trilho px-4 py-2.5 text-[13px] last:border-b-0">
              <span className="text-tinta-3">{quando(ev.em)}</span>
              <b>{ev.acao === "fechar" ? "Fechada" : "Reaberta"}</b>
              <span>por {nome.get(ev.autor) ?? "—"}</span>
              {ev.motivo ? <span className="text-tinta-2 italic">— {ev.motivo}</span> : null}
            </div>
          ))}
        </Cartao>
      ) : null}
    </>
  );
}
