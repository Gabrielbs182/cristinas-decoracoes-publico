"use client";

import { Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { definirModeloAtivo, definirProdutoAtivo, salvarModelo, salvarProduto, salvarRegrasOrcamento } from "@/app/(gestao)/catalogo/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { PainelLateral } from "@/components/ui/painel-lateral";
import { CampoDinheiro, Rotulado } from "@/components/ui/rotulado";
import { type Categoria, CATEGORIAS, ROTULO_UNIDADE } from "@/lib/vendas/calculo";
import { cn } from "@/lib/utils";

/** Liga/desliga com rótulo visível ("Ativo"/"Inativo"), não só cor. */
export function AlternarAtivo({ id, nome, ativo, tipo }: { id: string; nome: string; ativo: boolean; tipo: "produto" | "modelo" }) {
  const { enviando, executar } = useAcao();
  const acao = tipo === "produto" ? definirProdutoAtivo : definirModeloAtivo;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={`${nome}: ${ativo ? "ativo" : "inativo"}`}
      disabled={enviando}
      onClick={() => executar(() => acao({ id, ativo: !ativo }))}
      className="flex cursor-pointer items-center gap-2 text-[13px] font-bold disabled:opacity-50"
    >
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", ativo ? "bg-sucesso" : "bg-[#cfc3b3]")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", ativo ? "left-[18px]" : "left-0.5")} />
      </span>
      <span className={ativo ? "text-tinta" : "text-tinta-3"}>{ativo ? "Ativo" : "Inativo"}</span>
    </button>
  );
}

export interface ProdutoEditavel {
  id: string;
  nome: string;
  preco: string; // "89,90"
  larguraRolo: string; // "2,80" ou ""
  porUnidade: boolean;
}

export function PainelProduto({ categoria, produto }: { categoria: Categoria; produto?: ProdutoEditavel }) {
  const { enviando, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  const vazio = { nome: "", preco: "", larguraRolo: "", porUnidade: false };
  const [p, setP] = useState(vazio);
  const cat = CATEGORIAS.find((c) => c.categoria === categoria)!;
  const unidade = categoria === "servico" && p.porUnidade ? "un" : cat.unidade;

  return (
    <>
      {produto ? (
        <Botao
          variante="secundario"
          tamanho="p"
          aria-label={`Editar ${produto.nome}`}
          onClick={() => {
            setP({ nome: produto.nome, preco: produto.preco, larguraRolo: produto.larguraRolo, porUnidade: produto.porUnidade });
            setAberto(true);
          }}
        >
          <Pencil /> Editar
        </Botao>
      ) : (
        <Botao
          onClick={() => {
            setP(vazio);
            setAberto(true);
          }}
        >
          <Plus /> Produto
        </Botao>
      )}
      <PainelLateral aberto={aberto} aoFechar={() => setAberto(false)} subtitulo={`Catálogo · ${cat.rotulo}`} titulo={produto ? produto.nome : "Novo produto"}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            executar(() => salvarProduto({ id: produto?.id, categoria, ...p }), () => setAberto(false));
          }}
        >
          <Rotulado titulo="Nome">
            <Campo value={p.nome} onChange={(e) => setP((x) => ({ ...x, nome: e.target.value }))} maxLength={120} autoFocus />
          </Rotulado>
          {categoria === "servico" ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-bold">Cobrado por</legend>
              {[
                [false, "Vão (ex.: instalação)"],
                [true, "Unidade (ex.: lavagem de uma cortina)"],
              ].map(([v, r]) => (
                <label key={String(v)} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="por" checked={p.porUnidade === v} onChange={() => setP((x) => ({ ...x, porUnidade: v as boolean }))} className="accent-terracota" />
                  {r as string}
                </label>
              ))}
            </fieldset>
          ) : null}
          <Rotulado titulo={`Preço por ${ROTULO_UNIDADE[unidade]}`} dica="Em reais, como 89,90.">
            <CampoDinheiro value={p.preco} onChange={(e) => setP((x) => ({ ...x, preco: e.target.value }))} />
          </Rotulado>
          {categoria === "tecido" ? (
            <Rotulado titulo="Largura do rolo (opcional)" dica="Em metros, como 2,80. Ajuda a saber se o pano cobre a altura sem emenda.">
              <Campo value={p.larguraRolo} onChange={(e) => setP((x) => ({ ...x, larguraRolo: e.target.value }))} inputMode="decimal" className="w-32" />
            </Rotulado>
          ) : null}
          <Botao type="submit" disabled={enviando || p.nome.trim().length < 2 || !p.preco.trim()} className="self-start">
            {produto ? "Salvar" : "Cadastrar"}
          </Botao>
        </form>
      </PainelLateral>
    </>
  );
}

export interface ModeloEditavel {
  id: string;
  nome: string;
  fator: string; // "2,5"
  precoMetro: string; // "28,00"
}

export function PainelModelo({ modelo }: { modelo?: ModeloEditavel }) {
  const { enviando, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  const vazio = { nome: "", fator: "", precoMetro: "" };
  const [m, setM] = useState(vazio);

  return (
    <>
      {modelo ? (
        <Botao
          variante="secundario"
          tamanho="p"
          aria-label={`Editar ${modelo.nome}`}
          onClick={() => {
            setM({ nome: modelo.nome, fator: modelo.fator, precoMetro: modelo.precoMetro });
            setAberto(true);
          }}
        >
          <Pencil /> Editar
        </Botao>
      ) : (
        <Botao
          variante="secundario"
          tamanho="p"
          onClick={() => {
            setM(vazio);
            setAberto(true);
          }}
        >
          <Plus /> Modelo
        </Botao>
      )}
      <PainelLateral aberto={aberto} aoFechar={() => setAberto(false)} subtitulo="Catálogo · Modelos de confecção" titulo={modelo ? modelo.nome : "Novo modelo"}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            executar(() => salvarModelo({ id: modelo?.id, ...m }), () => setAberto(false));
          }}
        >
          <Rotulado titulo="Nome" dica="Ex.: Prega wave, Prega americana, Ilhós.">
            <Campo value={m.nome} onChange={(e) => setM((x) => ({ ...x, nome: e.target.value }))} maxLength={60} autoFocus />
          </Rotulado>
          <Rotulado titulo="Fator de franzimento" dica="Quantas vezes a largura do vão vira tecido (de 1,0 a 4,0). Wave costuma ser 2,5; ilhós, 2,0.">
            <Campo value={m.fator} onChange={(e) => setM((x) => ({ ...x, fator: e.target.value }))} inputMode="decimal" className="w-24 font-bold" />
          </Rotulado>
          <Rotulado titulo="Confecção por metro de tecido" dica="Em reais, como 28,00.">
            <CampoDinheiro value={m.precoMetro} onChange={(e) => setM((x) => ({ ...x, precoMetro: e.target.value }))} className="w-40" />
          </Rotulado>
          <Botao type="submit" disabled={enviando || m.nome.trim().length < 2 || !m.fator.trim() || !m.precoMetro.trim()} className="self-start">
            {modelo ? "Salvar" : "Cadastrar"}
          </Botao>
        </form>
      </PainelLateral>
    </>
  );
}

/** Sobra do trilho e área mínima da persiana. */
export function EditarRegras({ sobraTrilho, areaMinima }: { sobraTrilho: string; areaMinima: string }) {
  const { enviando, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  const [r, setR] = useState({ sobraTrilho, areaMinima });
  return (
    <>
      <Botao
        variante="secundario"
        tamanho="p"
        onClick={() => {
          setR({ sobraTrilho, areaMinima });
          setAberto(true);
        }}
      >
        <SlidersHorizontal /> Ajustar regras
      </Botao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo="Regras de cálculo"
        descricao="Valem para os próximos orçamentos. Orçamentos já feitos guardam a conta da época."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao disabled={enviando} onClick={() => executar(() => salvarRegrasOrcamento(r), () => setAberto(false))}>
              Salvar regras
            </Botao>
          </>
        }
      >
        <Rotulado titulo="Sobra do trilho (m)" dica="Somada à largura do vão. Ex.: 0,20.">
          <Campo value={r.sobraTrilho} onChange={(e) => setR((x) => ({ ...x, sobraTrilho: e.target.value }))} inputMode="decimal" className="w-28 font-bold" />
        </Rotulado>
        <Rotulado titulo="Área mínima da persiana (m²)" dica="Vão menor que isso é cobrado por essa área. Ex.: 1,50.">
          <Campo value={r.areaMinima} onChange={(e) => setR((x) => ({ ...x, areaMinima: e.target.value }))} inputMode="decimal" className="w-28 font-bold" />
        </Rotulado>
      </Dialogo>
    </>
  );
}
