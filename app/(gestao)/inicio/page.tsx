import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { contagens, rotuloSemana } from "@/components/ponto/barra-semana";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { diaMes, duracao, SIGLA_DIA, somarDias } from "@/lib/ponto";
import { carregarSemana, semanaPadrao } from "@/lib/ponto/servidor";
import { descricaoDoPedido } from "@/lib/ponto/solicitacoes";
import { brl } from "@/lib/vendas/numeros";
import { numeroOrcamento } from "@/lib/vendas/orcamento";
import { hojeSP } from "@/lib/vendas/servidor";
import { plural } from "@/lib/texto";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

function saudacao() {
  const h = Number(new Date().toLocaleString("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const cartao = "flex flex-col gap-3 rounded-[14px] border border-borda bg-superficie p-[18px] hover:border-borda-forte";

export default async function Inicio() {
  const sessao = await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const segunda = await semanaPadrao(supabase);
  const [semana, { data: solicitacoes, count: nSolicitacoes }, { data: enviados }, { data: aReceber }] = await Promise.all([
    carregarSemana(supabase, segunda),
    supabase
      .from("solicitacoes_correcao")
      .select("id, data, tipo_batida, hora_seg, ocorrencia, funcionarias(nome_exibicao)", { count: "exact" })
      .eq("status", "pendente")
      .order("criada_em")
      .limit(3),
    supabase.from("orcamentos").select("id, numero, valido_ate, total_centavos, clientes(nome)").eq("status", "enviado").order("valido_ate"),
    supabase.from("saldos_orcamentos").select("orcamento_id, numero, saldo_centavos, pago_centavos").gt("saldo_centavos", 0).order("saldo_centavos", { ascending: false }),
  ]);
  const totalAReceber = (aReceber ?? []).reduce((t, o) => t + (o.saldo_centavos ?? 0), 0);
  const { data: clientesAReceber } = aReceber?.length
    ? await supabase.from("orcamentos").select("id, clientes(nome)").in("id", aReceber.slice(0, 3).map((o) => o.orcamento_id!))
    : { data: [] };
  // Orçamentos enviados: os que vencem primeiro no topo; vencido é enviado com a validade no passado.
  const hojeIso = hojeSP();
  const emTres = somarDias(hojeIso, 3);
  const aguardando = (enviados ?? []).filter((o) => o.valido_ate && o.valido_ate >= hojeIso);
  const vencendo = aguardando.filter((o) => o.valido_ate! <= emTres).length;
  const vencidos = (enviados ?? []).length - aguardando.length;
  const { bloqueios, avisos } = contagens(semana);
  const bloqueantes = semana.funcionarias
    .flatMap((f) => f.resultado.dias.flatMap((d) => d.pendencias.filter((p) => p.severidade === "bloqueia").map((p) => ({ f, d, p }))))
    .slice(0, 3);
  const corte = [...semana.funcionarias].sort((a, b) => b.resultado.banco.acumuladoMin - a.resultado.banco.acumuladoMin);
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1">
        <div className="text-[13px] font-semibold text-tinta-3 first-letter:uppercase">{hoje}</div>
        <h1 className="font-display text-[32px] font-normal">
          {saudacao()}, {sessao.nome.split(" ")[0]}
        </h1>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Link href={`/ponto/pendencias?s=${segunda}`} className={cartao}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-extrabold text-tinta-3">PONTO · SEMANA {rotuloSemana(segunda).toUpperCase()}</span>
            <span className="text-[13px] font-bold text-terracota">Revisar ›</span>
          </div>
          {semana.temBatidas ? (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <b className="text-[40px] leading-none">{bloqueios + avisos}</b>
                <span className="text-base font-bold">{bloqueios + avisos === 1 ? "pendência" : "pendências"}</span>
                {bloqueios ? (
                  <Selo tom="perigo" icone="alerta" tamanho="g">
                    {plural(bloqueios, "bloqueia", "bloqueiam")} o fechamento
                  </Selo>
                ) : null}
                {avisos ? (
                  <Selo tom="atencao" icone="alerta" tamanho="g">
                    {plural(avisos, "aviso", "avisos")}
                  </Selo>
                ) : null}
              </div>
              <div className="flex flex-col border-t border-trilho">
                {bloqueantes.map(({ f, d, p }) => (
                  <div key={`${f.id}${d.data}${p.codigo}`} className="flex justify-between gap-2.5 border-b border-trilho py-2.5 text-sm">
                    <span>
                      <b>{f.nomeExibicao}</b> · {p.titulo.toLowerCase()}
                    </span>
                    <span className="text-tinta-3">
                      {SIGLA_DIA[d.dow]?.toLowerCase()} {diaMes(d.data)}
                    </span>
                  </div>
                ))}
                {!bloqueantes.length && !semana.idsDesconhecidos.length ? (
                  <div className="flex items-center gap-2 py-2.5 text-sm text-sucesso">
                    <Check className="size-4" /> Nada bloqueia o fechamento desta semana.
                  </div>
                ) : null}
                {semana.idsDesconhecidos.map((i) => (
                  <div key={i.enNo} className="flex justify-between gap-2.5 border-b border-trilho py-2.5 text-sm">
                    <span>
                      <b>ID {i.enNo.replace(/^0+/, "")}</b> · desconhecido na catraca
                    </span>
                    <span className="text-tinta-3">{i.batidas} batida(s)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-tinta-3">Esta semana ainda não tem batidas. Importe o arquivo da catraca para conferir as horas.</div>
          )}
        </Link>

        <Link href="/ponto/solicitacoes" className={cartao}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-extrabold text-tinta-3">SOLICITAÇÕES DE CORREÇÃO</span>
            <span className="text-[13px] font-bold text-terracota">Responder ›</span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <b className="text-[40px] leading-none">{nSolicitacoes ?? 0}</b>
            <span className="text-base font-bold">aguardando resposta</span>
          </div>
          <div className="flex flex-col border-t border-trilho">
            {(solicitacoes ?? []).map((s) => (
              <div key={s.id} className="flex justify-between gap-2.5 border-b border-trilho py-2.5 text-sm">
                <span>
                  <b>{s.funcionarias?.nome_exibicao}</b> · {descricaoDoPedido(s)}
                </span>
                <span className="text-tinta-3">{diaMes(s.data)}</span>
              </div>
            ))}
            {!nSolicitacoes ? <div className="py-2.5 text-sm text-tinta-3">Quando uma funcionária pedir correção pelo celular, aparece aqui.</div> : null}
          </div>
        </Link>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-3">
        <Link href="/orcamentos?s=enviado" className={cartao}>
          <span className="text-[13px] font-extrabold text-tinta-3">ORÇAMENTOS ENVIADOS</span>
          <div className="flex items-baseline gap-2.5">
            <b className="text-[40px] leading-none">{aguardando.length}</b>
            <span className="text-base font-bold">aguardando resposta</span>
          </div>
          {vencendo || vencidos ? (
            <span className={cn("text-sm font-semibold", vencidos ? "text-perigo" : "text-atencao")}>
              {[vencendo ? `${vencendo} vence${vencendo > 1 ? "m" : ""} em até 3 dias` : "", vencidos ? `${vencidos} vencido${vencidos > 1 ? "s" : ""} sem resposta` : ""].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          <div className="flex flex-col border-t border-trilho">
            {aguardando.slice(0, 3).map((o) => (
              <div key={o.id} className="flex justify-between gap-2.5 border-b border-trilho py-2 text-sm">
                <span className="truncate">
                  <b>{numeroOrcamento(o.numero)}</b> · {o.clientes?.nome}
                </span>
                <span className="whitespace-nowrap text-tinta-3">vence {diaMes(o.valido_ate!)}</span>
              </div>
            ))}
            {!aguardando.length ? <div className="py-2 text-sm text-tinta-3">Nenhum orçamento esperando resposta.</div> : null}
          </div>
        </Link>
        <Link href="/recibos/novo" className={cartao}>
          <span className="text-[13px] font-extrabold text-tinta-3">A RECEBER · ORÇAMENTOS APROVADOS</span>
          <div className="flex items-baseline gap-2.5">
            <b className="text-[32px] leading-none tabular-nums">{brl(totalAReceber)}</b>
          </div>
          <span className="text-sm text-tinta-2">
            {aReceber?.length ? `${aReceber.length} orçamento${aReceber.length > 1 ? "s" : ""} com saldo em aberto` : "Nenhum saldo em aberto."}
          </span>
          <div className="flex flex-col border-t border-trilho">
            {(aReceber ?? []).slice(0, 3).map((o) => (
              <div key={o.orcamento_id} className="flex justify-between gap-2.5 border-b border-trilho py-2 text-sm">
                <span className="truncate">
                  <b>{numeroOrcamento(o.numero!)}</b> · {clientesAReceber?.find((c) => c.id === o.orcamento_id)?.clientes?.nome}
                </span>
                <span className="whitespace-nowrap tabular-nums">{brl(o.saldo_centavos!)}</span>
              </div>
            ))}
          </div>
        </Link>
        <Link href="/ponto/banco" className={cartao}>
          <span className="text-[13px] font-extrabold text-tinta-3">BANCO DE HORAS · CORTE {duracao(semana.regras.horaCorteMin).toUpperCase()}</span>
          {corte.map((f) => {
            const b = f.resultado.banco;
            const pct = Math.min(100, Math.max(0, (b.acumuladoMin / semana.regras.horaCorteMin) * 100));
            return (
              <div key={f.id} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <b>{f.nomeExibicao}</b>
                  <span className={cn("font-bold", b.fechouCorte ? "text-sucesso" : "text-tinta")}>
                    {b.fechouCorte ? `✓ fechou · ${duracao(b.acumuladoMin)}` : `${duracao(b.acumuladoMin)} · faltam ${duracao(b.faltaParaCorteMin)}`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-trilho">
                  <div className={cn("h-full", b.fechouCorte ? "bg-sucesso" : "bg-terracota-barra")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </Link>
      </div>
    </div>
  );
}
