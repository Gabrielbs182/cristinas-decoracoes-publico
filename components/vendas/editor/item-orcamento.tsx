"use client";

import { AlertTriangle, Copy, Trash2 } from "lucide-react";
import { cloneElement, useId } from "react";

import { Campo, Selecao } from "@/components/ui/campos";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/vendas/numeros";
import { type Catalogo, type EntradaItem, type ItemCalculado, itemNovo, memoriaQuantidade, type ProdutoDoCatalogo, TIPOS_ITEM, type TipoItem } from "@/lib/vendas/orcamento";

/** Ativos + o que o item já usa (mesmo que tenha sido inativado depois). */
function opcoes(c: Catalogo, categoria: ProdutoDoCatalogo["categoria"], atual: string | null) {
  return c.produtos.filter((p) => p.categoria === categoria && (p.ativo || p.id === atual));
}

const UNIDADE_CURTA = { m: "m", m2: "m²", un: "un", vao: "vão" } as const;
const rotuloProduto = (p: ProdutoDoCatalogo) => `${p.nome} · ${brl(p.precoCentavos)}/${UNIDADE_CURTA[p.unidade]}${p.ativo ? "" : " (inativo)"}`;

function Campinho({ titulo, children, className }: { titulo: string; children: React.ReactElement<{ id?: string }>; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-bold text-tinta-2">
        {titulo}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}

const soDigitos = (v: string, max: number) => {
  const d = v.replace(/\D/g, "").slice(0, max);
  return d ? Number(d) : null;
};

export function ItemOrcamento({
  item,
  calculo,
  catalogo,
  numero,
  bloqueado,
  aoMudar,
  aoDuplicar,
  aoRemover,
}: {
  item: EntradaItem;
  calculo: ItemCalculado;
  catalogo: Catalogo;
  numero: number;
  bloqueado: boolean;
  aoMudar: (i: EntradaItem) => void;
  aoDuplicar: () => void;
  aoRemover: () => void;
}) {
  const muda = (parcial: Partial<EntradaItem>) => aoMudar({ ...item, ...parcial });
  const temAcionamento = item.tipo === "cortina" || item.tipo === "persiana";
  const temLargura = item.tipo === "cortina" || item.tipo === "persiana" || item.tipo === "trilho";
  const temAltura = item.tipo === "cortina" || item.tipo === "persiana";
  const categoria = item.tipo === "cortina" ? "tecido" : item.tipo;
  const rotuloPrincipal = { cortina: "Tecido", persiana: "Modelo", trilho: "Trilho / varão", acessorio: "Acessório", servico: "Serviço" }[item.tipo];
  const id = (s: string | null) => s ?? "";

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-superficie p-3.5", calculo.faltando.length ? "border-atencao-borda" : "border-borda")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold tracking-[.05em] text-tinta-3 uppercase">Item {numero}</span>
        {!bloqueado ? (
          <div className="flex gap-1">
            <button type="button" onClick={aoDuplicar} className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-bold text-tinta-2 hover:bg-suave">
              <Copy className="size-3.5" /> Duplicar
            </button>
            <button type="button" onClick={aoRemover} className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-bold text-perigo hover:bg-perigo-fundo" aria-label={`Remover item ${numero}`}>
              <Trash2 className="size-3.5" /> Remover
            </button>
          </div>
        ) : null}
      </div>

      <fieldset disabled={bloqueado} className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Campinho titulo="Produto" className="col-span-2 lg:col-span-1">
          <Selecao
            value={item.tipo}
            onChange={(e) => {
              const novo = itemNovo(item.id, e.target.value as TipoItem, catalogo);
              aoMudar({ ...novo, larguraCm: item.larguraCm, alturaCm: item.alturaCm, cor: item.cor, quantidade: item.quantidade });
            }}
          >
            {TIPOS_ITEM.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.rotulo}
              </option>
            ))}
          </Selecao>
        </Campinho>
        <Campinho titulo={rotuloPrincipal} className={item.tipo === "cortina" ? "col-span-2 lg:col-span-1" : "col-span-2"}>
          <Selecao value={id(item.produtoId)} onChange={(e) => muda({ produtoId: e.target.value || null })}>
            <option value="">Escolha…</option>
            {opcoes(catalogo, categoria, item.produtoId).map((p) => (
              <option key={p.id} value={p.id}>
                {rotuloProduto(p)}
              </option>
            ))}
          </Selecao>
        </Campinho>
        {item.tipo === "cortina" ? (
          <Campinho titulo="Confecção">
            <Selecao value={id(item.modeloId)} onChange={(e) => muda({ modeloId: e.target.value || null })}>
              <option value="">Escolha…</option>
              {catalogo.modelos
                .filter((m) => m.ativo || m.id === item.modeloId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} · fator {String(m.fatorFranzimento).replace(".", ",")}
                  </option>
                ))}
            </Selecao>
          </Campinho>
        ) : null}
        <Campinho titulo={temAcionamento ? "Cor" : "Detalhe (opcional)"}>
          <Campo value={item.cor} onChange={(e) => muda({ cor: e.target.value })} maxLength={60} />
        </Campinho>

        {temAcionamento ? (
          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-bold text-tinta-2" id={`acion-${item.id}`}>
              Acionamento
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-labelledby={`acion-${item.id}`} className="flex rounded-lg bg-suave p-0.5">
                {[
                  [false, "Manual"],
                  [true, "Motorizado"],
                ].map(([v, r]) => (
                  <button
                    key={r as string}
                    type="button"
                    role="radio"
                    aria-checked={item.motorizado === v}
                    onClick={() => muda({ motorizado: v as boolean })}
                    className={cn("h-9 cursor-pointer rounded-md px-3 text-[13px] font-bold", item.motorizado === v ? "bg-superficie shadow-sm" : "text-tinta-3")}
                  >
                    {r as string}
                  </button>
                ))}
              </div>
              {item.motorizado ? (
                <Selecao value={id(item.motorId)} onChange={(e) => muda({ motorId: e.target.value || null })} aria-label="Motor" className="w-auto min-w-0 flex-1">
                  <option value="">Escolha o motor…</option>
                  {opcoes(catalogo, "acessorio", item.motorId).map((p) => (
                    <option key={p.id} value={p.id}>
                      {rotuloProduto(p)}
                    </option>
                  ))}
                </Selecao>
              ) : null}
            </div>
          </div>
        ) : null}
        {item.tipo === "cortina" ? (
          <Campinho titulo="Trilho">
            <Selecao value={id(item.trilhoId)} onChange={(e) => muda({ trilhoId: e.target.value || null })}>
              <option value="">Sem trilho</option>
              {opcoes(catalogo, "trilho", item.trilhoId).map((p) => (
                <option key={p.id} value={p.id}>
                  {rotuloProduto(p)}
                </option>
              ))}
            </Selecao>
          </Campinho>
        ) : null}
        {temAcionamento ? (
          <Campinho titulo="Instalação">
            <Selecao value={id(item.instalacaoId)} onChange={(e) => muda({ instalacaoId: e.target.value || null })}>
              <option value="">Sem instalação</option>
              {opcoes(catalogo, "servico", item.instalacaoId).map((p) => (
                <option key={p.id} value={p.id}>
                  {rotuloProduto(p)}
                </option>
              ))}
            </Selecao>
          </Campinho>
        ) : null}

        {temLargura ? (
          <Campinho titulo="Largura do vão (cm)" className="col-start-1">
            <Campo
              value={item.larguraCm ?? ""}
              onChange={(e) => muda({ larguraCm: soDigitos(e.target.value, 4) })}
              inputMode="numeric"
              placeholder="ex.: 320"
              className="h-11 text-base font-bold tabular-nums"
            />
          </Campinho>
        ) : null}
        {temAltura ? (
          <Campinho titulo="Altura do vão (cm)">
            <Campo
              value={item.alturaCm ?? ""}
              onChange={(e) => muda({ alturaCm: soDigitos(e.target.value, 4) })}
              inputMode="numeric"
              placeholder="ex.: 270"
              className="h-11 text-base font-bold tabular-nums"
            />
          </Campinho>
        ) : null}
        <Campinho titulo="Quantidade" className={temLargura ? undefined : "col-start-1"}>
          <Campo value={item.quantidade} onChange={(e) => muda({ quantidade: soDigitos(e.target.value, 3) ?? 1 })} inputMode="numeric" className="h-11 text-base font-bold tabular-nums" />
        </Campinho>
      </fieldset>

      <div className="flex flex-col gap-1 rounded-lg bg-suave px-3 py-2.5" aria-live="polite">
        <span className="text-[11px] font-extrabold tracking-[.06em] text-tinta-3 uppercase">Memória de cálculo</span>
        {calculo.faltando.length ? (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-atencao">
            <AlertTriangle className="size-4" /> Falta informar: {calculo.faltando.join(", ")}.
          </span>
        ) : (
          calculo.linhas.map((l) => (
            <div key={l.rotulo} className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-baseline gap-2 text-[13px]">
              <b>{l.rotulo}</b>
              <span className="text-tinta-2">{l.memoria}</span>
              <span className="tabular-nums">{brl(l.valorCentavos)}</span>
            </div>
          ))
        )}
        {calculo.avisos.map((a) => (
          <span key={a} className="flex items-center gap-1.5 text-xs font-semibold text-atencao">
            <AlertTriangle className="size-3.5" /> {a}
          </span>
        ))}
        {!calculo.faltando.length ? (
          <div className="mt-1 grid grid-cols-[84px_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-trilho pt-1.5 text-sm">
            <b>Item</b>
            <span className="text-tinta-3">{memoriaQuantidade(calculo, item.quantidade)}</span>
            <b className="tabular-nums">{brl(calculo.totalCentavos)}</b>
          </div>
        ) : null}
      </div>
    </div>
  );
}
