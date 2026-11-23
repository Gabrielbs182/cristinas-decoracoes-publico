import { FileSpreadsheet, Plus, Receipt, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CancelarRecibo } from "@/components/vendas/cancelar-recibo";
import { Campo } from "@/components/ui/campos";
import { estilosBotao } from "@/components/ui/botao";
import { Cartao, EstadoVazio, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/vendas/numeros";
import { FORMAS, numeroRecibo, ROTULO_FORMA, ROTULO_TIPO } from "@/lib/vendas/recibos";
import { carregarRecibos, mesDoParametro, mesPorExtenso } from "@/lib/vendas/recibos-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recibos" };

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Últimos 12 meses para o filtro. */
function meses(atual: string): string[] {
  const [a, m] = atual.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(a!, m! - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export default async function PaginaRecibos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sessao = await exigirPapel("gestora", "contador");
  const gestora = sessao.papel === "gestora";
  const p = await searchParams;
  const mes = mesDoParametro(p.mes);
  const status = p.s === "emitido" || p.s === "cancelado" ? p.s : "todos";
  const forma = FORMAS.find((f) => f.forma === p.f)?.forma ?? "";
  const busca = typeof p.q === "string" ? p.q.trim().slice(0, 80) : "";
  const atual = mesDoParametro(undefined);

  const supabase = await criarClienteServidor();
  const recibos = await carregarRecibos(supabase, mes);
  const termo = normalizar(busca);
  const digitos = busca.replace(/\D/g, "");
  const visiveis = recibos.filter(
    (r) =>
      (status === "todos" || r.status === status) &&
      (!forma || r.forma === forma) &&
      (!termo ||
        normalizar(r.pagador).includes(termo) ||
        (digitos && (numeroRecibo(r.numero).includes(digitos) || (r.orcamentoNumero !== null && numeroRecibo(r.orcamentoNumero).includes(digitos))))),
  );
  const totalEmitido = visiveis.filter((r) => r.status === "emitido").reduce((t, r) => t + r.valorCentavos, 0);
  const link = (mudar: Record<string, string>) => {
    const q = new URLSearchParams({ ...(busca && { q: busca }), ...(status !== "todos" && { s: status }), ...(forma && { f: forma }), ...(mes !== atual && { mes }), ...mudar });
    for (const [k, v] of [...q]) if (!v || (k === "s" && v === "todos") || (k === "mes" && v === atual)) q.delete(k);
    return `/recibos${q.size ? `?${q}` : ""}`;
  };
  const chip = (ativo: boolean) =>
    cn("inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-bold no-underline", ativo ? "border-tinta bg-tinta text-white" : "border-borda-campo bg-superficie text-tinta");
  const colunas = "lg:grid lg:grid-cols-[64px_92px_minmax(0,1.5fr)_84px_120px_130px_110px_150px] lg:gap-x-3 lg:items-center";

  return (
    <>
      <TituloPagina contexto="Financeiro" titulo="Recibos">
        <a href={`/arquivos/recibos?mes=${mes}`} className={estilosBotao({ variante: "secundario" })}>
          <FileSpreadsheet /> Exportar .xlsx
        </a>
        {gestora ? (
          <Link href="/recibos/novo" className={estilosBotao({})}>
            <Plus /> Emitir recibo
          </Link>
        ) : null}
      </TituloPagina>

      <form className="flex flex-wrap items-center gap-2" action="/recibos">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
          <Campo name="q" defaultValue={busca} placeholder="Buscar por número, cliente ou orçamento" aria-label="Buscar recibo" className="h-10 pl-9" />
        </div>
        {status !== "todos" ? <input type="hidden" name="s" value={status} /> : null}
        <select name="f" defaultValue={forma} aria-label="Forma de pagamento" className="h-10 rounded-lg border border-borda-campo bg-superficie px-3 text-sm">
          <option value="">Todas as formas</option>
          {FORMAS.map((f) => (
            <option key={f.forma} value={f.forma}>
              {f.rotulo}
            </option>
          ))}
        </select>
        <select name="mes" defaultValue={mes} aria-label="Mês" className="h-10 rounded-lg border border-borda-campo bg-superficie px-3 text-sm">
          {meses(atual).map((m) => (
            <option key={m} value={m}>
              {mesPorExtenso(m)}
            </option>
          ))}
          <option value="todos">Todos os meses</option>
        </select>
        <button type="submit" className="h-10 cursor-pointer rounded-lg border border-borda-campo bg-superficie px-4 text-sm font-bold">
          Filtrar
        </button>
      </form>

      <nav className="flex flex-wrap gap-1.5" aria-label="Situação">
        {(["todos", "emitido", "cancelado"] as const).map((s) => (
          <Link key={s} href={link({ s })} className={chip(status === s)} aria-current={status === s ? "page" : undefined}>
            {{ todos: "Todos", emitido: "Emitidos", cancelado: "Cancelados" }[s]}
          </Link>
        ))}
      </nav>

      {!recibos.length ? (
        <EstadoVazio icone={<Receipt />} titulo={`Nenhum recibo em ${mesPorExtenso(mes)}`}>
          {gestora ? "Emita o recibo do sinal, da parcela ou da quitação a partir do orçamento aprovado, ou um avulso." : "Os recibos emitidos pela loja aparecem aqui."}
        </EstadoVazio>
      ) : (
        <Cartao className="overflow-hidden">
          <div className={cn("hidden border-b border-trilho bg-suave px-4 py-2.5", colunas)}>
            {["Nº", "Data", "Recebido de", "Orçamento", "Valor", "Forma", "Situação", ""].map((h, i) => (
              <Sobretitulo key={i} className={h === "Valor" ? "text-right" : undefined}>
                {h}
              </Sobretitulo>
            ))}
          </div>
          {!visiveis.length ? <div className="px-4 py-6 text-center text-sm text-tinta-3">Nenhum recibo com esses filtros.</div> : null}
          {visiveis.map((r) => (
            <div key={r.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-trilho px-4 py-3 text-sm last:border-b-0", colunas, r.status === "cancelado" && "bg-[#faf7f2]")}>
              <Link href={`/recibos/${r.id}`} className="font-bold tabular-nums">
                {numeroRecibo(r.numero)}
              </Link>
              <span className="text-tinta-2">{r.dataPagamento.split("-").reverse().join("/")}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className={cn("truncate", r.status === "cancelado" && "text-tinta-3 line-through")}>{r.pagador}</b>
                <span className="truncate text-xs text-tinta-3">{ROTULO_TIPO[r.tipo]}</span>
              </span>
              <span className="text-tinta-2">{r.orcamentoNumero ? numeroRecibo(r.orcamentoNumero) : "—"}</span>
              <b className={cn("tabular-nums lg:text-right", r.status === "cancelado" && "text-tinta-3 line-through")}>{brl(r.valorCentavos)}</b>
              <span className="text-tinta-2">{ROTULO_FORMA[r.forma]}</span>
              <span className="flex flex-col gap-0.5">
                <Selo tom={r.status === "cancelado" ? "perigo" : "ok"} icone={r.status === "cancelado" ? "x" : "check"}>
                  {r.status === "cancelado" ? "Cancelado" : "Emitido"}
                </Selo>
                {r.status === "cancelado" ? <span className="text-xs text-tinta-3">{r.motivoCancelamento}</span> : null}
              </span>
              <span className="flex gap-1.5 lg:justify-end">
                <a href={`/arquivos/recibo/${r.id}`} target="_blank" className={estilosBotao({ variante: "secundario", tamanho: "p" })}>
                  Imprimir
                </a>
                {gestora && r.status === "emitido" ? <CancelarRecibo id={r.id} numero={numeroRecibo(r.numero)} resumo={`${r.pagador} · ${brl(r.valorCentavos)}`} tamanho="p" /> : null}
              </span>
            </div>
          ))}
        </Cartao>
      )}
      <div className="flex flex-wrap justify-between gap-2 text-xs text-tinta-3">
        <span>
          {visiveis.length} recibo(s) · total emitido {brl(totalEmitido)} · {mesPorExtenso(mes)}
        </span>
        <span>Numeração sequencial: números cancelados não são reaproveitados.</span>
      </div>
    </>
  );
}
