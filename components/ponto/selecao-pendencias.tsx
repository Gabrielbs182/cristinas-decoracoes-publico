"use client";

/**
 * Seleção de várias pendências do MESMO tipo para aceitar a sugestão de uma vez (ex.: confirmar todos
 * os atrasos da semana). Misturar tipos não é permitido: cada tipo tem uma sugestão diferente.
 */
import { createContext, use, useState } from "react";

import { aceitarSugestoes } from "@/app/(gestao)/ponto/acoes";
import { Botao } from "@/components/ui/botao";
import type { CodigoPendencia } from "@/lib/ponto";

import { useAcao } from "./usar-acao";

export interface ItemSelecionavel {
  chave: string;
  funcionariaId: string;
  data: string;
  codigo: CodigoPendencia;
  titulo: string;
}

interface Contexto {
  itens: Map<string, ItemSelecionavel>;
  marcadas: Set<string>;
  alternar: (chave: string) => void;
}

const Ctx = createContext<Contexto | null>(null);

export function ProvedorSelecao({ itens, children }: { itens: ItemSelecionavel[]; children: React.ReactNode }) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const { enviando, executar } = useAcao();
  const mapa = new Map(itens.map((i) => [i.chave, i]));
  // Some da seleção o que deixou de existir (resolvido por outro caminho e a página recarregou).
  const validas = [...marcadas].filter((c) => mapa.has(c));
  const codigo = validas.length ? mapa.get(validas[0]!)!.codigo : null;
  const iguais = codigo ? itens.filter((i) => i.codigo === codigo) : [];

  const alternar = (chave: string) =>
    setMarcadas((m) => {
      const n = new Set([...m].filter((c) => mapa.has(c)));
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });

  return (
    <Ctx value={{ itens: mapa, marcadas: new Set(validas), alternar }}>
      {children}
      {validas.length ? (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2.5 rounded-xl bg-tinta px-4 py-3 text-white shadow-lg">
          <span className="flex-1 text-sm font-bold">
            {validas.length} selecionada{validas.length > 1 ? "s" : ""} · {mapa.get(validas[0]!)!.titulo}
          </span>
          {iguais.length > validas.length ? (
            <Botao variante="link" tamanho="p" className="text-white hover:text-white" onClick={() => setMarcadas(new Set(iguais.map((i) => i.chave)))}>
              Selecionar as {iguais.length} deste tipo
            </Botao>
          ) : null}
          <Botao variante="link" tamanho="p" className="text-white hover:text-white" onClick={() => setMarcadas(new Set())}>
            Limpar
          </Botao>
          <Botao
            tamanho="m"
            disabled={enviando}
            onClick={() =>
              executar(
                () => aceitarSugestoes({ itens: validas.map((c) => mapa.get(c)!).map(({ funcionariaId, data, codigo }) => ({ funcionariaId, data, codigo })) }),
                () => setMarcadas(new Set()),
              )
            }
          >
            Aceitar sugestão em todas
          </Botao>
        </div>
      ) : null}
    </Ctx>
  );
}

export function CaixaSelecao({ chave }: { chave: string }) {
  const ctx = use(Ctx);
  if (!ctx) return null;
  const item = ctx.itens.get(chave);
  if (!item) return null;
  const primeira = ctx.marcadas.size ? ctx.itens.get([...ctx.marcadas][0]!) : null;
  const outroTipo = !!primeira && primeira.codigo !== item.codigo;
  return (
    <input
      type="checkbox"
      className="size-[18px] flex-none cursor-pointer accent-terracota disabled:cursor-not-allowed"
      checked={ctx.marcadas.has(chave)}
      disabled={outroTipo}
      title={outroTipo ? "Só dá para resolver junto pendências do mesmo tipo" : "Selecionar para resolver junto"}
      aria-label={`Selecionar: ${item.titulo}`}
      onChange={() => ctx.alternar(chave)}
    />
  );
}
