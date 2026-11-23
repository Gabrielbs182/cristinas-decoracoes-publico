/** O recibo como sai no papel (meia folha), em HTML: prévia da emissão e tela do recibo. */
import Image from "next/image";

import { valorPorExtenso } from "@/lib/vendas/extenso";
import { brl } from "@/lib/vendas/numeros";
import { cidadeDoRecibo, dataPorExtenso, type FormaPagamento, ROTULO_FORMA } from "@/lib/vendas/recibos";

export interface DadosReciboVisual {
  numero: string;
  valorCentavos: number;
  pagador: string;
  referente: string;
  forma: FormaPagamento;
  data: string;
  empresa: { nome: string; razao_social: string; cnpj: string; telefone: string; cidade_uf: string };
  cancelado?: { em: string; motivo: string } | null;
}

export function ReciboVisual({ d }: { d: DadosReciboVisual }) {
  const empresa = d.empresa.nome || "Cristina's Decorações";
  const contato = [d.empresa.razao_social, d.empresa.cnpj && `CNPJ ${d.empresa.cnpj}`, d.empresa.telefone].filter(Boolean).join(" · ");
  const cidade = cidadeDoRecibo(d.empresa.cidade_uf);
  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-borda bg-white p-5 text-tinta shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-borda pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image src="/logo-circulo.png" alt="" width={40} height={40} priority className="size-10 flex-none rounded-full" />
          <div className="flex min-w-0 flex-col">
            <span className="font-display text-base leading-tight">{empresa}</span>
            {contato ? <span className="text-[10px] text-tinta-3">{contato}</span> : null}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <span className="text-[10px] font-extrabold tracking-[.08em] text-terracota">RECIBO Nº {d.numero}</span>
          <span className="rounded-md bg-terracota-claro px-2.5 py-1 font-display text-lg tabular-nums">{brl(d.valorCentavos)}</span>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-pretty">
        Recebi de <b>{d.pagador || "—"}</b> a importância de <b>{d.valorCentavos > 0 ? valorPorExtenso(d.valorCentavos) : "—"}</b>, referente {d.referente || "—"}.
      </p>
      <span className="text-xs text-tinta-2">Forma de pagamento: {ROTULO_FORMA[d.forma]}</span>
      <span className="text-right text-xs">
        {cidade ? `${cidade}, ` : ""}
        {d.data ? dataPorExtenso(d.data) : "—"}.
      </span>
      <div className="ml-auto flex w-56 flex-col items-center gap-1 pt-4">
        <span className="h-px w-full bg-tinta-3" />
        <span className="text-center text-[10px] text-tinta-3">{[d.empresa.razao_social, empresa].filter(Boolean).join(" · ")}</span>
      </div>
      {d.cancelado ? (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-0 grid -rotate-12 place-items-center text-5xl font-extrabold tracking-widest text-perigo/20">
            CANCELADO
          </span>
          <span className="text-xs font-bold text-perigo">
            Cancelado em {new Date(d.cancelado.em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}: {d.cancelado.motivo}
          </span>
        </>
      ) : null}
    </div>
  );
}
