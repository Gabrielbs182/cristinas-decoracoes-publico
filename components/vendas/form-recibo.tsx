"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { emitirRecibo } from "@/app/(gestao)/recibos/acoes";
import { Botao } from "@/components/ui/botao";
import { Campo, Selecao } from "@/components/ui/campos";
import { Cartao } from "@/components/ui/cartao";
import { CampoDinheiro, Rotulado } from "@/components/ui/rotulado";
import { cn } from "@/lib/utils";
import { brl, centavosDeTexto, reaisParaCampo } from "@/lib/vendas/numeros";
import { FORMAS, type FormaPagamento, numeroRecibo, textoReferente, type TipoRecibo, valorSugerido } from "@/lib/vendas/recibos";

import { type DadosReciboVisual, ReciboVisual } from "./recibo-visual";

export interface OrcamentoComSaldo {
  id: string;
  numero: number;
  cliente: string;
  ambientes: string[];
  totalCentavos: number;
  pagoCentavos: number;
  saldoCentavos: number;
}

const TIPOS: { tipo: Exclude<TipoRecibo, "avulso">; rotulo: string }[] = [
  { tipo: "sinal", rotulo: "Sinal" },
  { tipo: "parcela", rotulo: "Parcela" },
  { tipo: "quitacao", rotulo: "Quitação" },
];

export function FormRecibo({
  orcamentos,
  inicial,
  proximo,
  hoje,
  empresa,
}: {
  orcamentos: OrcamentoComSaldo[];
  inicial: string | null;
  proximo: number;
  hoje: string;
  empresa: DadosReciboVisual["empresa"];
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const primeiro = orcamentos.find((o) => o.id === inicial) ?? orcamentos[0] ?? null;
  const [modo, setModo] = useState<"orcamento" | "avulso">(primeiro ? "orcamento" : "avulso");
  const [orcId, setOrcId] = useState(primeiro?.id ?? "");
  const [tipo, setTipo] = useState<Exclude<TipoRecibo, "avulso">>(primeiro && primeiro.pagoCentavos > 0 ? "quitacao" : "sinal");
  const sugerir = (o: OrcamentoComSaldo | null, t: TipoRecibo) => {
    const v = o ? valorSugerido(t, o.totalCentavos, o.saldoCentavos) : null;
    return v ? reaisParaCampo(v) : "";
  };
  const [valor, setValor] = useState(() => sugerir(primeiro, primeiro && primeiro.pagoCentavos > 0 ? "quitacao" : "sinal"));
  const [pagador, setPagador] = useState(primeiro?.cliente ?? "");
  const [avulso, setAvulso] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [data, setData] = useState(hoje);
  const [vias, setVias] = useState(true);

  const o = modo === "orcamento" ? (orcamentos.find((x) => x.id === orcId) ?? null) : null;
  const centavos = centavosDeTexto(valor || "0") ?? 0;
  const acima = !!o && centavos > o.saldoCentavos;
  const quitacaoErrada = !!o && tipo === "quitacao" && centavos !== o.saldoCentavos;
  const referente = o ? textoReferente(tipo, { orcamentoNumero: o.numero, ambientes: o.ambientes }) : avulso.trim() ? textoReferente("avulso", { avulso }) : "";
  const pronto = centavos > 0 && pagador.trim().length >= 2 && !acima && !quitacaoErrada && (modo === "orcamento" ? !!o : avulso.trim().length >= 3) && data <= hoje;

  const escolherOrcamento = (id: string) => {
    const novo = orcamentos.find((x) => x.id === id) ?? null;
    const t = novo && novo.pagoCentavos > 0 ? "quitacao" : "sinal";
    setOrcId(id);
    setTipo(t);
    setValor(sugerir(novo, t));
    setPagador(novo?.cliente ?? "");
  };
  const escolherTipo = (t: Exclude<TipoRecibo, "avulso">) => {
    setTipo(t);
    setValor(sugerir(o, t));
  };

  const emitir = () =>
    iniciar(async () => {
      const r = await emitirRecibo({ tipo: modo === "orcamento" ? tipo : "avulso", orcamentoId: o?.id ?? null, pagador, avulso, valor, forma, data });
      if (!r.ok || !r.id) {
        toast.error(r.ok ? "Não deu para emitir." : r.erro);
        return;
      }
      toast.success(r.mensagem);
      router.push(`/recibos/${r.id}?vias=${vias ? 2 : 1}`);
    });

  const botaoModo = (ativo: boolean) => cn("h-9 cursor-pointer rounded-md px-3.5 text-[13px] font-bold", ativo ? "bg-superficie shadow-sm" : "text-tinta-3");

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Cartao className="flex flex-col gap-4 p-5">
        <div role="radiogroup" aria-label="De onde vem o pagamento" className="flex self-start rounded-lg bg-suave p-0.5">
          <button type="button" role="radio" aria-checked={modo === "orcamento"} className={botaoModo(modo === "orcamento")} onClick={() => setModo("orcamento")} disabled={!orcamentos.length}>
            De um orçamento
          </button>
          <button type="button" role="radio" aria-checked={modo === "avulso"} className={botaoModo(modo === "avulso")} onClick={() => setModo("avulso")}>
            Avulso
          </button>
        </div>

        {modo === "orcamento" ? (
          <>
            {orcamentos.length ? (
              <Rotulado titulo="Orçamento aprovado">
                <Selecao value={orcId} onChange={(e) => escolherOrcamento(e.target.value)}>
                  {orcamentos.map((x) => (
                    <option key={x.id} value={x.id}>
                      {numeroRecibo(x.numero)} · {x.cliente} · saldo {brl(x.saldoCentavos)}
                    </option>
                  ))}
                </Selecao>
              </Rotulado>
            ) : (
              <span className="text-sm text-tinta-3">Nenhum orçamento aprovado com saldo a receber.</span>
            )}
            {o ? (
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-suave p-3 text-center">
                {[
                  ["Total", o.totalCentavos],
                  ["Já pago", o.pagoCentavos],
                  ["Saldo", o.saldoCentavos],
                ].map(([r, v]) => (
                  <div key={r} className="flex flex-col">
                    <span className="text-xs text-tinta-3">{r}</span>
                    <b className="tabular-nums">{brl(v as number)}</b>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold" id="tipo-recibo">
                Tipo
              </span>
              <div role="radiogroup" aria-labelledby="tipo-recibo" className="flex self-start rounded-lg bg-suave p-0.5">
                {TIPOS.map((t) => (
                  <button key={t.tipo} type="button" role="radio" aria-checked={tipo === t.tipo} className={botaoModo(tipo === t.tipo)} onClick={() => escolherTipo(t.tipo)}>
                    {t.rotulo}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <Rotulado titulo="Referente a" dica="Ex.: conserto de varão, lavagem de duas cortinas.">
            <Campo value={avulso} onChange={(e) => setAvulso(e.target.value)} maxLength={280} />
          </Rotulado>
        )}

        <Rotulado titulo="Recebi de">
          <Campo value={pagador} onChange={(e) => setPagador(e.target.value)} maxLength={120} placeholder="Nome de quem pagou" />
        </Rotulado>

        <Rotulado
          titulo="Valor recebido"
          dica={
            acima
              ? `Maior que o saldo do orçamento (${brl(o!.saldoCentavos)}).`
              : quitacaoErrada
                ? `Quitação é o saldo inteiro: ${brl(o!.saldoCentavos)}.`
                : o && centavos > 0
                  ? centavos === o.saldoCentavos
                    ? "✓ Quita o orçamento."
                    : `Saldo depois deste recibo: ${brl(o.saldoCentavos - centavos)}.`
                  : undefined
          }
        >
          <CampoDinheiro value={valor} onChange={(e) => setValor(e.target.value)} className={cn("w-48", (acima || quitacaoErrada) && "[&_input]:border-perigo")} />
        </Rotulado>

        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulado titulo="Forma de pagamento">
            <Selecao value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
              {FORMAS.map((f) => (
                <option key={f.forma} value={f.forma}>
                  {f.rotulo}
                </option>
              ))}
            </Selecao>
          </Rotulado>
          <Rotulado titulo="Data do pagamento">
            <Campo type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} />
          </Rotulado>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={vias} onChange={(e) => setVias(e.target.checked)} className="size-4 accent-terracota" />
          Imprimir em duas vias (cliente e empresa) na mesma folha
        </label>
        <Botao tamanho="g" className="font-extrabold" disabled={!pronto || enviando} onClick={emitir}>
          Emitir recibo de {brl(centavos)}
        </Botao>
      </Cartao>

      <div className="flex flex-col gap-2 lg:sticky lg:top-4">
        <span className="text-xs font-extrabold tracking-[.06em] text-tinta-3 uppercase">Prévia · meia folha A4</span>
        <ReciboVisual d={{ numero: numeroRecibo(proximo), valorCentavos: centavos, pagador, referente, forma, data, empresa }} />
        <span className="text-xs text-pretty text-tinta-3">O número é confirmado na emissão. Recibo emitido não muda: se errar, cancele (o número não volta) e emita outro.</span>
      </div>
    </div>
  );
}
