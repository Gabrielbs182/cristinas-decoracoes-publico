import type { Metadata } from "next";
import Link from "next/link";

import { AlternarAtivo, EditarRegras, PainelModelo, PainelProduto } from "@/components/vendas/catalogo";
import { Cartao, CabecalhoCartao, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { type Categoria, CATEGORIAS, exemploTecido, regraDaCategoria, ROTULO_UNIDADE, type Unidade } from "@/lib/vendas/calculo";
import { brl, fator, metros, reaisParaCampo } from "@/lib/vendas/numeros";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catálogo e preços" };

export default async function PaginaCatalogo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPapel("gestora");
  const params = await searchParams;
  const categoria = (CATEGORIAS.find((c) => c.categoria === params.cat)?.categoria ?? "tecido") as Categoria;
  const supabase = await criarClienteServidor();
  const [{ data: produtos }, { data: modelos }, { data: regras }] = await Promise.all([
    supabase.from("produtos").select("id, categoria, nome, unidade, preco_centavos, largura_rolo_cm, ativo").order("nome"),
    supabase.from("modelos_confeccao").select("id, nome, fator_franzimento, preco_metro_centavos, ativo").order("nome"),
    supabase.from("regras_orcamento").select("sobra_trilho_cm, area_minima_persiana_cm2").maybeSingle(),
  ]);
  const r = { sobraTrilhoCm: regras?.sobra_trilho_cm ?? 20, areaMinimaPersianaCm2: regras?.area_minima_persiana_cm2 ?? 15000 };
  const modelosAtivos = (modelos ?? []).filter((m) => m.ativo).map((m) => ({ nome: m.nome, fatorFranzimento: Number(m.fator_franzimento), precoMetroCentavos: m.preco_metro_centavos }));
  // Ativos primeiro; inativos continuam na lista (orçamentos antigos apontam para eles).
  const daCategoria = (produtos ?? []).filter((p) => p.categoria === categoria).sort((a, b) => Number(b.ativo) - Number(a.ativo));
  const tecidoExemplo = (produtos ?? []).find((p) => p.categoria === "tecido" && p.ativo);
  // Última coluna com largura fixa: cada linha é uma grade própria, e "auto" desalinharia o cabeçalho.
  const colunas = categoria === "tecido" ? "md:grid-cols-[minmax(0,1.6fr)_90px_120px_110px_130px_96px]" : "md:grid-cols-[minmax(0,1.6fr)_90px_120px_130px_96px]";
  const aba = (ativa: boolean) =>
    cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold no-underline", ativa ? "border-tinta bg-tinta text-white" : "border-borda-campo bg-superficie text-tinta");

  return (
    <>
      <TituloPagina contexto="Vendas" titulo="Catálogo de produtos e preços">
        <PainelProduto categoria={categoria} />
      </TituloPagina>

      <nav className="flex flex-wrap gap-1.5" aria-label="Categorias">
        {CATEGORIAS.map((c) => {
          const n = (produtos ?? []).filter((p) => p.categoria === c.categoria && p.ativo).length;
          return (
            <Link key={c.categoria} href={`/catalogo?cat=${c.categoria}`} className={aba(c.categoria === categoria)} aria-current={c.categoria === categoria ? "page" : undefined}>
              {c.rotulo} <span className="opacity-70">{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-suave px-4 py-3">
        <b className="text-[13px] text-terracota-escuro">Regra de cálculo</b>
        <span className="min-w-60 flex-1 text-sm text-pretty">{regraDaCategoria(categoria, r, modelosAtivos)}</span>
        {categoria === "trilho" || categoria === "persiana" ? (
          <EditarRegras sobraTrilho={metros(r.sobraTrilhoCm).replace(" m", "")} areaMinima={(r.areaMinimaPersianaCm2 / 10000).toFixed(2).replace(".", ",")} />
        ) : null}
      </div>

      <Cartao className="overflow-hidden">
        <div className={cn("hidden border-b border-trilho bg-suave px-4 py-2.5 md:grid md:gap-x-4", colunas)}>
          {["Produto", "Unidade", "Preço", ...(categoria === "tecido" ? ["Largura do rolo"] : []), "Situação", ""].map((h) => (
            <Sobretitulo key={h}>{h}</Sobretitulo>
          ))}
        </div>
        {!daCategoria.length ? <div className="px-4 py-6 text-center text-sm text-tinta-3">Nenhum produto nesta categoria. Use “+ Produto”.</div> : null}
        {daCategoria.map((p) => (
          <div key={p.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-trilho px-4 py-3 text-sm last:border-b-0 md:grid", colunas, !p.ativo && "bg-[#faf7f2]")}>
            <b className={cn("w-full text-[15px] md:w-auto", !p.ativo && "text-tinta-3")}>{p.nome}</b>
            <span className="text-tinta-2">{ROTULO_UNIDADE[p.unidade as Unidade]}</span>
            <b className="tabular-nums">{brl(p.preco_centavos)}</b>
            {categoria === "tecido" ? <span className="tabular-nums">{p.largura_rolo_cm ? metros(p.largura_rolo_cm) : "—"}</span> : null}
            <AlternarAtivo id={p.id} nome={p.nome} ativo={p.ativo} tipo="produto" />
            <div className="md:justify-self-end">
              <PainelProduto
                categoria={categoria}
                produto={{
                  id: p.id,
                  nome: p.nome,
                  preco: reaisParaCampo(p.preco_centavos),
                  larguraRolo: p.largura_rolo_cm ? (p.largura_rolo_cm / 100).toFixed(2).replace(".", ",") : "",
                  porUnidade: p.unidade === "un",
                }}
              />
            </div>
          </div>
        ))}
      </Cartao>

      {categoria === "tecido" ? (
        <Cartao className="overflow-hidden">
          <CabecalhoCartao>
            <div className="flex flex-col">
              <b className="text-[15px]">Modelos de confecção</b>
              <span className="text-[13px] text-tinta-3">O fator de franzimento transforma a largura do vão em metros de tecido; a confecção é cobrada por metro.</span>
            </div>
            <PainelModelo />
          </CabecalhoCartao>
          {!(modelos ?? []).length ? <div className="px-4 py-5 text-center text-sm text-tinta-3">Cadastre os modelos que a loja faz (wave, americana, ilhós…).</div> : null}
          {(modelos ?? []).map((m) => {
            const mod = { nome: m.nome, fatorFranzimento: Number(m.fator_franzimento), precoMetroCentavos: m.preco_metro_centavos };
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-trilho px-4 py-3 text-sm last:border-b-0">
                <b className={cn("min-w-40 text-[15px]", !m.ativo && "text-tinta-3")}>{m.nome}</b>
                <span>
                  fator <b>{fator(mod.fatorFranzimento)}</b>
                </span>
                <span>
                  confecção <b className="tabular-nums">{brl(m.preco_metro_centavos)}</b>/m
                </span>
                {tecidoExemplo ? (
                  <span className="min-w-60 flex-1 text-xs text-tinta-3">
                    Ex. com {tecidoExemplo.nome}: {exemploTecido(300, mod, tecidoExemplo.preco_centavos)}
                  </span>
                ) : (
                  <span className="flex-1" />
                )}
                <AlternarAtivo id={m.id} nome={m.nome} ativo={m.ativo} tipo="modelo" />
                <PainelModelo modelo={{ id: m.id, nome: m.nome, fator: fator(mod.fatorFranzimento), precoMetro: reaisParaCampo(m.preco_metro_centavos) }} />
              </div>
            );
          })}
        </Cartao>
      ) : null}
    </>
  );
}
