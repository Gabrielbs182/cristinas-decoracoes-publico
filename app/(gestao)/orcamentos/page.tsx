import { FileText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NovoOrcamento } from "@/components/vendas/novo-orcamento";
import { Campo } from "@/components/ui/campos";
import { Cartao, EstadoVazio, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { somarDias } from "@/lib/ponto";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/vendas/numeros";
import { numeroOrcamento, ROTULO_SITUACAO, situacaoDoOrcamento } from "@/lib/vendas/orcamento";
import { hojeSP } from "@/lib/vendas/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orçamentos" };

const SELO = {
  rascunho: { tom: "neutro", icone: "circulo" },
  enviado: { tom: "info", icone: "relogio" },
  vencido: { tom: "perigo", icone: "alerta" },
  aprovado: { tom: "ok", icone: "check" },
  recusado: { tom: "perigo", icone: "x" },
  cancelado: { tom: "neutro", icone: "x" },
} as const;

const FILTROS = ["todos", "rascunho", "enviado", "vencido", "aprovado", "recusado", "cancelado"] as const;
const PERIODOS = { "90d": "Últimos 90 dias", mes: "Este mês", ano: "Este ano", tudo: "Tudo" } as const;

/** Situação do pagamento de um orçamento aprovado (os outros não têm). */
function pagamentoDe(s: { pago_centavos: number | null; saldo_centavos: number | null } | undefined) {
  if (!s) return null;
  if (!s.saldo_centavos) return { rotulo: "Quitado", tom: "text-sucesso" };
  if (s.pago_centavos) return { rotulo: `Falta ${brl(s.saldo_centavos)}`, tom: "text-atencao" };
  return { rotulo: "A receber", tom: "text-tinta-2" };
}

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default async function PaginaOrcamentos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPapel("gestora");
  const p = await searchParams;
  const filtro = FILTROS.find((f) => f === p.s) ?? "todos";
  const periodo = (Object.keys(PERIODOS).find((k) => k === p.p) ?? "90d") as keyof typeof PERIODOS;
  const busca = typeof p.q === "string" ? p.q.trim().slice(0, 80) : "";
  const hoje = hojeSP();
  const desde =
    periodo === "90d"
      ? somarDias(hoje, -90)
      : periodo === "mes"
        ? `${hoje.slice(0, 7)}-01`
        : periodo === "ano"
          ? `${hoje.slice(0, 4)}-01-01`
          : "2000-01-01";

  const supabase = await criarClienteServidor();
  const [{ data: orcamentos }, { data: clientes }, { data: saldos }] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("id, numero, status, valido_ate, total_centavos, criado_em, clientes(nome), orcamento_ambientes(nome, ordem)")
      .gte("criado_em", `${desde}T00:00:00-03:00`)
      .order("numero", { ascending: false })
      .limit(500),
    supabase.from("clientes").select("id, nome, telefone, residencia_bairro, obra_bairro").order("nome").limit(2000),
    supabase.from("saldos_orcamentos").select("orcamento_id, pago_centavos, saldo_centavos"),
  ]);
  const saldoDe = new Map((saldos ?? []).map((s) => [s.orcamento_id, s]));

  const linhas = (orcamentos ?? []).map((o) => ({
    ...o,
    situacao: situacaoDoOrcamento(o.status, o.valido_ate, hoje),
    cliente: o.clientes?.nome ?? "—",
    ambientes: [...(o.orcamento_ambientes ?? [])].sort((a, b) => a.ordem - b.ordem).map((a) => a.nome),
    pagamento: pagamentoDe(saldoDe.get(o.id)),
  }));
  const termo = normalizar(busca);
  const visiveis = linhas.filter(
    (o) => (filtro === "todos" || o.situacao === filtro) && (!termo || normalizar(o.cliente).includes(termo) || numeroOrcamento(o.numero).includes(termo.replace(/\D/g, "") || "_")),
  );
  const contagem = (f: (typeof FILTROS)[number]) => (f === "todos" ? linhas.length : linhas.filter((o) => o.situacao === f).length);
  const link = (mudar: Record<string, string>) => {
    const q = new URLSearchParams({ ...(busca && { q: busca }), ...(filtro !== "todos" && { s: filtro }), ...(periodo !== "90d" && { p: periodo }), ...mudar });
    for (const [k, v] of [...q]) if (!v || (k === "s" && v === "todos") || (k === "p" && v === "90d")) q.delete(k);
    return `/orcamentos${q.size ? `?${q}` : ""}`;
  };
  const chip = (ativo: boolean) =>
    cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold no-underline", ativo ? "border-tinta bg-tinta text-white" : "border-borda-campo bg-superficie text-tinta");
  const colunas = "md:grid md:grid-cols-[70px_minmax(0,1.6fr)_96px_110px_120px_110px_110px] md:gap-x-4 md:items-center";

  return (
    <>
      <TituloPagina contexto="Vendas" titulo="Orçamentos">
        <NovoOrcamento clientes={(clientes ?? []).map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone, bairro: c.residencia_bairro || c.obra_bairro }))} />
      </TituloPagina>

      <form className="flex flex-wrap items-center gap-2" action="/orcamentos">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
          <Campo name="q" defaultValue={busca} placeholder="Buscar por número ou cliente" aria-label="Buscar orçamento" className="h-10 pl-9" />
        </div>
        {filtro !== "todos" ? <input type="hidden" name="s" value={filtro} /> : null}
        <select name="p" defaultValue={periodo} aria-label="Período" className="h-10 rounded-lg border border-borda-campo bg-superficie px-3 text-sm">
          {Object.entries(PERIODOS).map(([k, r]) => (
            <option key={k} value={k}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 cursor-pointer rounded-lg border border-borda-campo bg-superficie px-4 text-sm font-bold">
          Filtrar
        </button>
      </form>

      <nav className="flex flex-wrap gap-1.5" aria-label="Situação">
        {FILTROS.map((f) => (
          <Link key={f} href={link({ s: f })} className={chip(filtro === f)} aria-current={filtro === f ? "page" : undefined}>
            {f === "todos" ? "Todos" : ROTULO_SITUACAO[f]} <span className="opacity-70">{contagem(f)}</span>
          </Link>
        ))}
      </nav>

      {!linhas.length && periodo === "90d" && !busca ? (
        <EstadoVazio icone={<FileText />} titulo="Nenhum orçamento ainda">
          Comece pelo “Novo orçamento”: escolha o cliente, monte os ambientes com as medidas e o sistema calcula tudo com o catálogo.
        </EstadoVazio>
      ) : (
        <Cartao className="overflow-hidden">
          <div className={cn("hidden border-b border-trilho bg-suave px-4 py-2.5", colunas)}>
            {["Nº", "Cliente", "Data", "Validade", "Valor", "Situação", "Pagamento"].map((h) => (
              <Sobretitulo key={h} className={h === "Valor" ? "text-right" : undefined}>
                {h}
              </Sobretitulo>
            ))}
          </div>
          {!visiveis.length ? <div className="px-4 py-6 text-center text-sm text-tinta-3">Nenhum orçamento com esses filtros.</div> : null}
          {visiveis.map((o) => (
            <Link
              key={o.id}
              href={`/orcamentos/${o.id}`}
              className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-trilho px-4 py-3 text-sm text-tinta no-underline last:border-b-0 hover:bg-suave", colunas)}
            >
              <b className="tabular-nums">{numeroOrcamento(o.numero)}</b>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate">{o.cliente}</b>
                <span className="truncate text-xs text-tinta-3">{o.ambientes.join(" · ") || "sem ambientes"}</span>
              </span>
              <span className="text-tinta-2">{new Date(o.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              <span className={cn("text-tinta-2", o.situacao === "vencido" && "font-bold text-perigo")}>{o.valido_ate ? o.valido_ate.split("-").reverse().join("/") : "—"}</span>
              <b className="tabular-nums md:text-right">{brl(o.total_centavos)}</b>
              <Selo tom={SELO[o.situacao].tom} icone={SELO[o.situacao].icone} className="self-center">
                {ROTULO_SITUACAO[o.situacao]}
              </Selo>
              <span className={cn("text-[13px] font-bold", o.pagamento?.tom)}>{o.pagamento?.rotulo ?? ""}</span>
            </Link>
          ))}
        </Cartao>
      )}
      <span className="text-xs text-tinta-3">
        {visiveis.length} de {linhas.length} orçamento(s) · {PERIODOS[periodo].toLowerCase()}
      </span>
    </>
  );
}
