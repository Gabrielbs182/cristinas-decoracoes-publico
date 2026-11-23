"use client";

import { ChevronLeft, Copy, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { salvarObsInterna, salvarOrcamento } from "@/app/(gestao)/orcamentos/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Selecao } from "@/components/ui/campos";
import { Cartao } from "@/components/ui/cartao";
import { CampoDinheiro, Rotulado } from "@/components/ui/rotulado";
import { Selo } from "@/components/ui/selo";
import { cn } from "@/lib/utils";
import { brl, centavosDeTexto, reaisParaCampo } from "@/lib/vendas/numeros";
import {
  calcularItem,
  calcularTotais,
  type Catalogo,
  type EntradaItem,
  itemNovo,
  numeroOrcamento,
  percentual,
  percentualDeTexto,
  type Precos,
  precosDoItem,
  ROTULO_SITUACAO,
} from "@/lib/vendas/orcamento";
import type { AmbienteEditavel, OrcamentoEditavel } from "@/lib/vendas/servidor";

import { type Pagamentos, PagamentosDoOrcamento } from "../pagamentos-orcamento";
import { AcoesOrcamento } from "./acoes-orcamento";
import { ItemOrcamento } from "./item-orcamento";

export interface ClienteDoEditor {
  id: string;
  nome: string;
  telefone: string;
  enderecos: { rotulo: string; endereco: string }[];
}

type Doc = Pick<OrcamentoEditavel, "clienteId" | "enderecoObra" | "validadeDias" | "prazoEntrega" | "condicoes" | "desconto" | "deslocamentoCentavos" | "obsCliente" | "obsInterna" | "ambientes">;
type Estado = { tipo: "salvo"; quando: string } | { tipo: "pendente" } | { tipo: "salvando" } | { tipo: "erro"; mensagem: string };

const SELO_SITUACAO = {
  rascunho: { tom: "neutro", icone: "circulo" },
  enviado: { tom: "info", icone: "relogio" },
  vencido: { tom: "perigo", icone: "alerta" },
  aprovado: { tom: "ok", icone: "check" },
  recusado: { tom: "perigo", icone: "x" },
  cancelado: { tom: "neutro", icone: "x" },
} as const;

const CONDICOES = ["50% de sinal e 50% na instalação", "À vista no PIX", "Sinal de 30% e saldo em 3x no cartão", "100% na aprovação"];
const hora = (ts: string) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const novoId = () => crypto.randomUUID();

export function EditorOrcamento({
  orcamento: o,
  catalogo,
  clientes,
  linkCliente,
  pagamentos,
}: {
  orcamento: OrcamentoEditavel;
  catalogo: Catalogo;
  clientes: ClienteDoEditor[];
  linkCliente: string;
  pagamentos: Pagamentos | null;
}) {
  const router = useRouter();
  const bloqueado = o.status !== "rascunho";
  const [doc, setDoc] = useState<Doc>(() => ({
    clienteId: o.clienteId,
    enderecoObra: o.enderecoObra,
    validadeDias: o.validadeDias,
    prazoEntrega: o.prazoEntrega,
    condicoes: o.condicoes,
    desconto: o.desconto,
    deslocamentoCentavos: o.deslocamentoCentavos,
    obsCliente: o.obsCliente,
    obsInterna: o.obsInterna,
    ambientes: o.ambientes,
  }));
  const [congelados, setCongelados] = useState<Record<string, { chave: string; precos: Precos }>>(o.congelados);
  const [estado, setEstado] = useState<Estado>({ tipo: "salvo", quando: "" });
  const [descontoTexto, setDescontoTexto] = useState(o.desconto.modo === "pct" ? String(o.desconto.valor / 100).replace(".", ",") : reaisParaCampo(o.desconto.valor));
  const [deslocamentoTexto, setDeslocamentoTexto] = useState(reaisParaCampo(o.deslocamentoCentavos));

  // ------------------------------------------------------------------ salvamento automático (em ordem)
  const docRef = useRef(doc);
  const sujo = useRef(false);
  const emVoo = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Grava o que estiver pendente; se mudar enquanto grava, grava de novo. Nunca dois salvamentos ao mesmo tempo. */
  const salvarAgora = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    for (;;) {
      if (emVoo.current) await emVoo.current;
      if (!sujo.current) return true;
      sujo.current = false;
      setEstado({ tipo: "salvando" });
      const d = docRef.current;
      const p = salvarOrcamento({ id: o.id, ...d }).then((r) => {
        if (!r.ok) {
          sujo.current = true; // continua pendente para a próxima tentativa
          setEstado({ tipo: "erro", mensagem: r.erro });
          toast.error(r.erro);
          return false;
        }
        setCongelados((c) => ({ ...c, ...r.congelados }));
        setEstado({ tipo: "salvo", quando: hora(r.salvoEm) });
        return true;
      });
      emVoo.current = p;
      const ok = await p;
      emVoo.current = null;
      if (!ok) return false;
    }
  }, [o.id]);

  /** Toda edição passa por aqui: atualiza o documento e agenda o salvamento. */
  const alterar = (f: (d: Doc) => Doc) => {
    setDoc((d) => {
      const novo = f(d);
      docRef.current = novo;
      return novo;
    });
    if (bloqueado) return;
    sujo.current = true;
    setEstado({ tipo: "pendente" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvarAgora(), 900);
  };

  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (sujo.current || emVoo.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  // ------------------------------------------------------------------ cálculo ao vivo
  const calculos = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calcularItem>>();
    for (const a of doc.ambientes) for (const i of a.itens) m.set(i.id, calcularItem(i, precosDoItem(i, catalogo, congelados[i.id])));
    return m;
  }, [doc.ambientes, catalogo, congelados]);
  const subtotalDe = (a: AmbienteEditavel) => a.itens.reduce((t, i) => t + (calculos.get(i.id)?.totalCentavos ?? 0), 0);
  const totais = calcularTotais(
    doc.ambientes.flatMap((a) => a.itens.map((i) => calculos.get(i.id)?.totalCentavos ?? 0)),
    doc.desconto,
    doc.deslocamentoCentavos,
  );

  // ------------------------------------------------------------------ edição
  const muda = (parcial: Partial<Doc>) => alterar((d) => ({ ...d, ...parcial }));
  const mudaAmbiente = (id: string, f: (a: AmbienteEditavel) => AmbienteEditavel) => alterar((d) => ({ ...d, ambientes: d.ambientes.map((a) => (a.id === id ? f(a) : a)) }));
  const mudaItem = (ambId: string, item: EntradaItem) => mudaAmbiente(ambId, (a) => ({ ...a, itens: a.itens.map((i) => (i.id === item.id ? item : i)) }));
  const cliente = clientes.find((c) => c.id === doc.clienteId);
  const enderecos = cliente?.enderecos ?? [];
  const outroEndereco = !enderecos.some((e) => e.endereco === doc.enderecoObra);

  const voltar = async () => {
    if (await salvarAgora()) router.push("/orcamentos");
  };

  const textoSalvo =
    estado.tipo === "salvando" ? "Salvando…" : estado.tipo === "pendente" ? "Alterações não salvas" : estado.tipo === "erro" ? "Não salvou — tente de novo" : estado.quando ? `Salvo às ${estado.quando}` : "Tudo salvo";

  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-0">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={voltar} className="flex cursor-pointer items-center gap-1 self-start text-sm font-bold text-terracota">
          <ChevronLeft className="size-4" /> Orçamentos
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="font-display text-[28px] leading-tight font-medium">Orçamento nº {numeroOrcamento(o.numero)}</h1>
          <Selo tom={SELO_SITUACAO[o.situacao].tom} icone={SELO_SITUACAO[o.situacao].icone} tamanho="g" className="self-center">
            {ROTULO_SITUACAO[o.situacao]}
          </Selo>
          {!bloqueado ? (
            <span role="status" className={cn("text-[13px]", estado.tipo === "erro" ? "font-bold text-perigo" : "text-tinta-3")}>
              {textoSalvo}
              {estado.tipo === "erro" ? (
                <button type="button" onClick={() => void salvarAgora()} className="ml-2 cursor-pointer underline">
                  Tentar de novo
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
        <SituacaoTexto o={o} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao className="p-4">
            <fieldset disabled={bloqueado} className="grid gap-3 sm:grid-cols-2">
              <Rotulado titulo="Cliente">
                <Selecao
                  value={doc.clienteId}
                  onChange={(e) => {
                    const c = clientes.find((x) => x.id === e.target.value);
                    muda({ clienteId: e.target.value, enderecoObra: c?.enderecos[0]?.endereco ?? "" });
                  }}
                >
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.telefone ? ` · ${c.telefone}` : ""}
                    </option>
                  ))}
                </Selecao>
              </Rotulado>
              <Rotulado titulo="Endereço da obra">
                <Selecao
                  value={outroEndereco ? "__outro" : doc.enderecoObra}
                  onChange={(e) => muda({ enderecoObra: e.target.value === "__outro" ? "" : e.target.value })}
                >
                  {enderecos.map((e) => (
                    <option key={e.rotulo} value={e.endereco}>
                      {e.rotulo} · {e.endereco}
                    </option>
                  ))}
                  <option value="__outro">Outro endereço…</option>
                </Selecao>
              </Rotulado>
              {outroEndereco ? (
                <Rotulado titulo="Outro endereço" className="sm:col-span-2">
                  <Campo value={doc.enderecoObra} onChange={(e) => muda({ enderecoObra: e.target.value })} maxLength={300} placeholder="Rua, número — bairro, cidade" />
                </Rotulado>
              ) : null}
              <Rotulado titulo="Condições de pagamento">
                <Campo value={doc.condicoes} onChange={(e) => muda({ condicoes: e.target.value })} maxLength={200} list={`condicoes-${o.id}`} />
              </Rotulado>
              <datalist id={`condicoes-${o.id}`}>
                {CONDICOES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <Rotulado titulo="Prazo de entrega">
                <Campo value={doc.prazoEntrega} onChange={(e) => muda({ prazoEntrega: e.target.value })} maxLength={120} />
              </Rotulado>
              <Rotulado titulo="Validade (dias)" dica={o.validoAte ? undefined : "Conta a partir do envio."}>
                <Campo
                  value={doc.validadeDias}
                  onChange={(e) => muda({ validadeDias: Math.min(365, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
                  inputMode="numeric"
                  className="w-24"
                />
              </Rotulado>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold">Atendimento</span>
                <span className="text-sm text-tinta-2">{o.vendedora || "—"}</span>
              </div>
            </fieldset>
          </Cartao>

          {doc.ambientes.length > 1 ? (
            <nav aria-label="Ambientes" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
              {doc.ambientes.map((a) => (
                <a key={a.id} href={`#amb-${a.id}`} className="flex h-9 flex-none items-center rounded-full border border-borda-campo bg-superficie px-3.5 text-[13px] font-bold text-tinta no-underline">
                  {a.nome}
                </a>
              ))}
            </nav>
          ) : null}

          {doc.ambientes.map((a) => (
            <section key={a.id} id={`amb-${a.id}`} className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-borda bg-[#fbf9f5] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Campo
                  value={a.nome}
                  onChange={(e) => mudaAmbiente(a.id, (x) => ({ ...x, nome: e.target.value }))}
                  aria-label="Nome do ambiente"
                  maxLength={60}
                  disabled={bloqueado}
                  // basis-40: no celular o nome ocupa a linha e o resto quebra para baixo (com base 0 o campo sumia).
                  className="h-10 max-w-60 min-w-0 grow basis-40 border-transparent bg-transparent font-display text-xl hover:border-borda-campo disabled:opacity-100"
                />
                <span className="text-[13px] text-tinta-3">
                  {a.itens.length} {a.itens.length === 1 ? "item" : "itens"}
                </span>
                <b className="ml-auto text-[15px] tabular-nums">{brl(subtotalDe(a))}</b>
                {!bloqueado ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-bold text-tinta-2 hover:bg-suave"
                      onClick={() =>
                        alterar((d) => {
                          const k = d.ambientes.findIndex((x) => x.id === a.id);
                          const copia = { id: novoId(), nome: `${a.nome} (cópia)`.slice(0, 60), itens: a.itens.map((i) => ({ ...i, id: novoId() })) };
                          return { ...d, ambientes: [...d.ambientes.slice(0, k + 1), copia, ...d.ambientes.slice(k + 1)] };
                        })
                      }
                    >
                      <Copy className="size-3.5" /> Duplicar
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover o ambiente ${a.nome}`}
                      className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-bold text-perigo hover:bg-perigo-fundo"
                      onClick={() => {
                        if (a.itens.length && !window.confirm(`Remover o ambiente ${a.nome} e os ${a.itens.length} itens dele?`)) return;
                        alterar((d) => ({ ...d, ambientes: d.ambientes.filter((x) => x.id !== a.id) }));
                      }}
                    >
                      <Trash2 className="size-3.5" /> Remover
                    </button>
                  </div>
                ) : null}
              </div>
              {a.itens.map((i, k) => (
                <ItemOrcamento
                  key={i.id}
                  item={i}
                  calculo={calculos.get(i.id)!}
                  catalogo={catalogo}
                  numero={k + 1}
                  bloqueado={bloqueado}
                  aoMudar={(novo) => mudaItem(a.id, novo)}
                  aoDuplicar={() => mudaAmbiente(a.id, (x) => ({ ...x, itens: [...x.itens.slice(0, k + 1), { ...i, id: novoId() }, ...x.itens.slice(k + 1)] }))}
                  aoRemover={() => mudaAmbiente(a.id, (x) => ({ ...x, itens: x.itens.filter((y) => y.id !== i.id) }))}
                />
              ))}
              {!bloqueado ? (
                <Botao variante="secundario" className="self-start border-dashed" onClick={() => mudaAmbiente(a.id, (x) => ({ ...x, itens: [...x.itens, itemNovo(novoId(), "cortina", catalogo)] }))}>
                  <Plus /> Item neste ambiente
                </Botao>
              ) : null}
            </section>
          ))}
          {!bloqueado ? (
            <Botao
              variante="secundario"
              tamanho="g"
              className="border-dashed text-terracota"
              onClick={() => alterar((d) => ({ ...d, ambientes: [...d.ambientes, { id: novoId(), nome: `Ambiente ${d.ambientes.length + 1}`, itens: [] }] }))}
            >
              <Plus /> Ambiente (sala, quarto, escritório…)
            </Botao>
          ) : null}

          <Cartao className="grid gap-3 p-4 sm:grid-cols-2">
            <Rotulado titulo="Observações para o cliente" dica="Saem no PDF e no link.">
              <AreaTexto value={doc.obsCliente} onChange={(e) => muda({ obsCliente: e.target.value })} maxLength={2000} disabled={bloqueado} />
            </Rotulado>
            <ObsInterna id={o.id} valor={doc.obsInterna} bloqueado={bloqueado} aoMudar={(v) => muda({ obsInterna: v })} />
          </Cartao>
        </div>

        <aside id="resumo" className="flex scroll-mt-4 flex-col gap-3 lg:sticky lg:top-4">
          <Cartao className="flex flex-col gap-2 p-4 text-sm">
            <span className="text-xs font-extrabold tracking-[.06em] text-tinta-3 uppercase">Resumo</span>
            {doc.ambientes.map((a) => (
              <div key={a.id} className="flex justify-between gap-2">
                <span className="truncate">{a.nome}</span>
                <span className="tabular-nums">{brl(subtotalDe(a))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-trilho pt-2 font-semibold">
              <span>Subtotal</span>
              <span className="tabular-nums">{brl(totais.subtotal)}</span>
            </div>
            <fieldset disabled={bloqueado} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span id={`desc-${o.id}`}>Desconto</span>
                <div className="flex items-center gap-1.5">
                  <div role="radiogroup" aria-labelledby={`desc-${o.id}`} className="flex rounded-md bg-suave p-0.5">
                    {(["pct", "brl"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={doc.desconto.modo === m}
                        onClick={() => {
                          setDescontoTexto("0");
                          muda({ desconto: { modo: m, valor: 0 } });
                        }}
                        className={cn("h-7 cursor-pointer rounded px-2 text-xs font-bold", doc.desconto.modo === m ? "bg-superficie shadow-sm" : "text-tinta-3")}
                      >
                        {m === "pct" ? "%" : "R$"}
                      </button>
                    ))}
                  </div>
                  <Campo
                    value={descontoTexto}
                    aria-label={doc.desconto.modo === "pct" ? "Desconto em %" : "Desconto em reais"}
                    inputMode="decimal"
                    className="h-8 w-24 text-right tabular-nums"
                    onChange={(e) => {
                      setDescontoTexto(e.target.value);
                      const v = doc.desconto.modo === "pct" ? percentualDeTexto(e.target.value || "0") : centavosDeTexto(e.target.value || "0");
                      if (v !== null) muda({ desconto: { modo: doc.desconto.modo, valor: v } });
                    }}
                  />
                </div>
              </div>
              {totais.desconto ? (
                <div className="flex justify-between text-sucesso">
                  <span>{doc.desconto.modo === "pct" ? percentual(doc.desconto.valor) : "Desconto"}</span>
                  <span className="tabular-nums">− {brl(totais.desconto)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`desl-${o.id}`}>Taxa de deslocamento</label>
                <CampoDinheiro
                  id={`desl-${o.id}`}
                  value={deslocamentoTexto}
                  className="w-32"
                  onChange={(e) => {
                    setDeslocamentoTexto(e.target.value);
                    const v = centavosDeTexto(e.target.value || "0");
                    if (v !== null) muda({ deslocamentoCentavos: v });
                  }}
                />
              </div>
            </fieldset>
            <div className="mt-1 flex flex-col gap-0.5 rounded-xl bg-terracota-claro px-3.5 py-3">
              <span className="text-xs font-extrabold tracking-[.06em] text-terracota uppercase">Total do orçamento</span>
              <b className="font-display text-[28px] tabular-nums">{brl(totais.total)}</b>
              {doc.condicoes ? <span className="text-xs text-tinta-2">{doc.condicoes}</span> : null}
            </div>
          </Cartao>
          {pagamentos ? <PagamentosDoOrcamento orcamentoId={o.id} p={pagamentos} /> : null}
          <AcoesOrcamento
            garantirSalvo={salvarAgora}
            temRecibo={!!pagamentos?.recibos.some((r) => r.status === "emitido")}
            d={{
              id: o.id,
              numero: numeroOrcamento(o.numero),
              situacao: o.situacao,
              validadeDias: doc.validadeDias,
              linkCliente,
              clienteNome: cliente?.nome ?? "",
              clienteTelefone: cliente?.telefone ?? "",
              enderecoObra: doc.enderecoObra,
            }}
          />
        </aside>
      </div>

      {/* Celular: total sempre à vista. */}
      <a
        href="#resumo"
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-borda bg-superficie px-4 py-3 text-tinta no-underline shadow-[0_-6px_20px_rgba(43,36,33,.08)] lg:hidden"
      >
        <span className="flex flex-col">
          <span className="text-xs text-tinta-3">{bloqueado ? ROTULO_SITUACAO[o.situacao] : textoSalvo}</span>
          <span className="text-xs font-bold">Ver resumo e enviar</span>
        </span>
        <b className="font-display text-2xl tabular-nums">{brl(totais.total)}</b>
      </a>
    </div>
  );
}

function SituacaoTexto({ o }: { o: OrcamentoEditavel }) {
  const data = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
  const dataIso = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");
  const t: Record<typeof o.situacao, string> = {
    rascunho: "Rascunho: edite à vontade, tudo é salvo sozinho. A cliente só vê depois de enviado.",
    enviado: `Enviado em ${data(o.enviadoEm)} · válido até ${dataIso(o.validoAte)}. Aguardando a resposta da cliente.`,
    vencido: `Venceu em ${dataIso(o.validoAte)} sem resposta. Para renovar, volte a editar e envie de novo.`,
    aprovado: `Aprovado${o.aprovadoPeloLink ? " pela cliente, pelo link," : ""} em ${data(o.respondidoEm)}.`,
    recusado: `Recusado em ${data(o.respondidoEm)}${o.respostaMotivo ? `: ${o.respostaMotivo}` : "."}`,
    cancelado: "Rascunho descartado. Fica guardado só para o histórico (o número não é reaproveitado).",
  };
  return <p className="text-sm text-pretty text-tinta-3">{t[o.situacao]}</p>;
}

/** Observação interna: no rascunho vai com o salvamento automático; depois do envio tem botão próprio. */
function ObsInterna({ id, valor, bloqueado, aoMudar }: { id: string; valor: string; bloqueado: boolean; aoMudar: (v: string) => void }) {
  const { enviando, executar } = useAcao();
  const [texto, setTexto] = useState(valor);
  return (
    <div className="flex flex-col gap-1.5">
      <Rotulado titulo="Observações internas" dica="Não saem no PDF nem no link.">
        <AreaTexto
          value={bloqueado ? texto : valor}
          onChange={(e) => (bloqueado ? setTexto(e.target.value) : aoMudar(e.target.value))}
          maxLength={2000}
        />
      </Rotulado>
      {bloqueado && texto !== valor ? (
        <Botao tamanho="p" className="self-start" disabled={enviando} onClick={() => executar(() => salvarObsInterna({ id, texto }))}>
          Salvar observação
        </Botao>
      ) : null}
    </div>
  );
}
