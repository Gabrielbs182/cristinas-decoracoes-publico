/** Recebimentos de um orçamento aprovado: total, pago, saldo e os recibos. */
import { Plus } from "lucide-react";
import Link from "next/link";

import { estilosBotao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/vendas/numeros";
import { numeroRecibo, ROTULO_TIPO, type TipoRecibo } from "@/lib/vendas/recibos";

export interface Pagamentos {
  totalCentavos: number;
  pagoCentavos: number;
  saldoCentavos: number;
  recibos: { id: string; numero: number; tipo: TipoRecibo; valorCentavos: number; dataPagamento: string; status: "emitido" | "cancelado" }[];
}

export function PagamentosDoOrcamento({ orcamentoId, p }: { orcamentoId: string; p: Pagamentos }) {
  return (
    <Cartao className="flex flex-col gap-2.5 p-4 text-sm">
      <span className="text-xs font-extrabold tracking-[.06em] text-tinta-3 uppercase">Recebimentos</span>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col">
          <span className="text-xs text-tinta-3">Recebido</span>
          <b className="tabular-nums text-sucesso">{brl(p.pagoCentavos)}</b>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-tinta-3">Saldo</span>
          <b className={cn("tabular-nums", p.saldoCentavos ? "text-tinta" : "text-sucesso")}>{p.saldoCentavos ? brl(p.saldoCentavos) : "Quitado"}</b>
        </div>
      </div>
      {p.recibos.map((r) => (
        <Link key={r.id} href={`/recibos/${r.id}`} className={cn("flex justify-between gap-2 border-t border-trilho pt-2 text-tinta no-underline", r.status === "cancelado" && "text-tinta-3 line-through")}>
          <span>
            <b className="tabular-nums">{numeroRecibo(r.numero)}</b> · {ROTULO_TIPO[r.tipo]} · {r.dataPagamento.split("-").reverse().join("/")}
          </span>
          <span className="tabular-nums">{brl(r.valorCentavos)}</span>
        </Link>
      ))}
      {p.saldoCentavos > 0 ? (
        <Link href={`/recibos/novo?orcamento=${orcamentoId}`} className={estilosBotao({ className: "mt-1" })}>
          <Plus /> Emitir recibo
        </Link>
      ) : null}
    </Cartao>
  );
}
