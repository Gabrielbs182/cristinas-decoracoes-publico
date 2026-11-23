import { FileText, MessageSquare } from "lucide-react";
import type { Metadata } from "next";

import { AcoesSolicitacao } from "@/components/ponto/acoes-solicitacao";
import { Cartao, EstadoVazio, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { diaMes, horaDeSeg, isoDow, NOME_OCORRENCIA, NOME_TIPO, segundaDe, SIGLA_DIA } from "@/lib/ponto";
import { carregarSemana, type SemanaCarregada } from "@/lib/ponto/servidor";
import { descricaoDoPedido, enderecoDoAnexo, planoDeAprovacao } from "@/lib/ponto/solicitacoes";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Solicitações" };

const SITUACAO = {
  pendente: { tom: "atencao", icone: "relogio", rotulo: "Aguardando" },
  aprovada: { tom: "ok", icone: "check", rotulo: "Aprovada" },
  recusada: { tom: "perigo", icone: "x", rotulo: "Recusada" },
} as const;

const quando = (ts: string) =>
  new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");

const ehImagem = (caminho: string) => /\.(jpe?g|png|webp)$/i.test(caminho);

export default async function PaginaSolicitacoes() {
  await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const campos = "id, funcionaria_id, data, tipo_batida, hora_seg, ocorrencia, motivo, anexo_path, status, resposta, criada_em, funcionarias(nome_exibicao)";
  const [{ data: pendentes }, { data: respondidas }] = await Promise.all([
    supabase.from("solicitacoes_correcao").select(campos).eq("status", "pendente").order("criada_em"),
    supabase.from("solicitacoes_correcao").select(campos).neq("status", "pendente").order("respondida_em", { ascending: false }).limit(30),
  ]);

  // Uma carga por semana envolvida: o plano de aprovação depende de como o dia está agora.
  const semanas = new Map<string, SemanaCarregada>();
  for (const segunda of new Set((pendentes ?? []).map((s) => segundaDe(s.data)))) semanas.set(segunda, await carregarSemana(supabase, segunda));

  return (
    <>
      <TituloPagina contexto="Ponto e RH" titulo="Solicitações de correção" />
      <Sobretitulo>Aguardando resposta ({pendentes?.length ?? 0})</Sobretitulo>
      {!pendentes?.length ? (
        <EstadoVazio icone={<MessageSquare />} titulo="Nenhuma solicitação aguardando">
          Quando uma funcionária pedir correção pelo celular, ela aparece aqui.
        </EstadoVazio>
      ) : (
        pendentes.map((s) => {
          const segunda = segundaDe(s.data);
          const semana = semanas.get(segunda)!;
          const dia = semana.funcionarias.find((f) => f.id === s.funcionaria_id)?.resultado.dias.find((d) => d.data === s.data);
          const fechada = semana.status === "fechada";
          let plano: string | null = null;
          try {
            plano = dia ? planoDeAprovacao(dia, s).descricao : null;
          } catch {
            plano = null;
          }
          return (
            <Cartao key={s.id} className="grid gap-3.5 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <b className="text-base">{s.funcionarias?.nome_exibicao}</b>
                  <span className="text-[13px] text-tinta-3">enviada em {quando(s.criada_em)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-tinta-3">Dia</span>
                    <b className="text-[15px]">
                      {SIGLA_DIA[isoDow(s.data)]} {diaMes(s.data)}
                    </b>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-tinta-3">{s.tipo_batida ? "Batida" : "Ocorrência"}</span>
                    <b className="text-[15px]">{s.tipo_batida ? NOME_TIPO[s.tipo_batida] : NOME_OCORRENCIA[s.ocorrencia!]}</b>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-tinta-3">Pedido</span>
                    <b className="text-[15px]">{s.hora_seg != null ? horaDeSeg(s.hora_seg) : "Abonar o dia"}</b>
                  </div>
                </div>
                <div className="rounded-lg bg-suave px-3 py-2.5 text-sm text-pretty">“{s.motivo}”</div>
                {dia ? (
                  <span className="text-[13px] text-tinta-3">
                    Batidas do dia hoje:{" "}
                    {dia.batidas
                      .filter((b) => b.tipo)
                      .map((b) => b.hora)
                      .join(" · ") || "nenhuma"}
                  </span>
                ) : null}
                {s.anexo_path ? (
                  <a href={enderecoDoAnexo(s.anexo_path)} target="_blank" className="flex items-center gap-2.5 self-start text-[13px] font-bold">
                    {ehImagem(s.anexo_path) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- anexo privado servido pela rota com sessão; o otimizador do Next não tem o cookie
                      <img src={enderecoDoAnexo(s.anexo_path)} alt="Anexo enviado pela funcionária" className="h-12 w-16 rounded-md border border-borda object-cover" />
                    ) : (
                      <span className="grid h-12 w-16 place-items-center rounded-md border border-borda bg-suave">
                        <FileText className="size-5 text-tinta-3" />
                      </span>
                    )}
                    Abrir anexo
                  </a>
                ) : null}
              </div>
              <AcoesSolicitacao
                id={s.id}
                linkDia={`/ponto/semana?s=${segunda}&d=${s.funcionaria_id}_${s.data}`}
                plano={plano}
                bloqueio={fechada ? "A semana já foi fechada. Reabra para aprovar." : !dia ? "Dia fora da semana carregada." : null}
              />
            </Cartao>
          );
        })
      )}

      <Sobretitulo className="mt-1.5">Respondidas</Sobretitulo>
      <Cartao className="overflow-hidden">
        {!respondidas?.length ? <div className="px-4 py-3 text-sm text-tinta-3">Nenhuma ainda.</div> : null}
        {(respondidas ?? []).map((s) => {
          const st = SITUACAO[s.status];
          return (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-trilho px-4 py-3 text-sm last:border-b-0 md:grid md:grid-cols-[140px_70px_200px_minmax(0,1fr)_110px]"
            >
              <b>{s.funcionarias?.nome_exibicao}</b>
              <span>{diaMes(s.data)}</span>
              <span>{descricaoDoPedido(s)}</span>
              <span className="basis-full text-[13px] text-pretty text-tinta-2">{s.resposta}</span>
              <Selo tom={st.tom} icone={st.icone}>
                {st.rotulo}
              </Selo>
            </div>
          );
        })}
      </Cartao>
    </>
  );
}
