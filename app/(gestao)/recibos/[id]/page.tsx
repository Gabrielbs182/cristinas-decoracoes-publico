import { ChevronLeft, FileDown, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelarRecibo } from "@/components/vendas/cancelar-recibo";
import { ReciboVisual } from "@/components/vendas/recibo-visual";
import { estilosBotao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { brl } from "@/lib/vendas/numeros";
import { numeroRecibo, ROTULO_TIPO } from "@/lib/vendas/recibos";
import { carregarDocumentoRecibo } from "@/lib/vendas/recibos-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recibo" };

export default async function PaginaRecibo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sessao = await exigirPapel("gestora", "contador");
  const { id } = await params;
  const vias = (await searchParams).vias === "1" ? 1 : 2;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteServidor();
  const r = await carregarDocumentoRecibo(supabase, id);
  if (!r) notFound();
  const numero = numeroRecibo(r.numero);
  const cancelado = r.status === "cancelado";

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/recibos" className="flex items-center gap-1 self-start text-sm font-bold">
          <ChevronLeft className="size-4" /> Recibos
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="font-display text-[28px] leading-tight font-medium">Recibo nº {numero}</h1>
          <Selo tom={cancelado ? "perigo" : "ok"} icone={cancelado ? "x" : "check"} tamanho="g" className="self-center">
            {cancelado ? "Cancelado" : "Emitido"}
          </Selo>
          <span className="text-sm text-tinta-3">
            {ROTULO_TIPO[r.tipo]} · {brl(r.valor_centavos)}
          </span>
        </div>
        {r.orcamentoId && sessao.papel === "gestora" ? (
          <Link href={`/orcamentos/${r.orcamentoId}`} className="self-start text-sm font-bold">
            Ver o orçamento
          </Link>
        ) : null}
      </div>

      <ReciboVisual
        d={{
          numero,
          valorCentavos: r.valor_centavos,
          pagador: r.pagador,
          referente: r.referente,
          forma: r.forma,
          data: r.data_pagamento,
          empresa: r.empresa,
          cancelado: cancelado && r.cancelado_em ? { em: r.cancelado_em, motivo: r.motivo_cancelamento } : null,
        }}
      />

      <div className="flex flex-wrap gap-2">
        <a href={`/arquivos/recibo/${r.id}?vias=${vias}`} target="_blank" className={estilosBotao({ tamanho: "g", className: "font-extrabold" })}>
          <Printer /> Imprimir {vias === 2 ? "(duas vias)" : "(uma via)"}
        </a>
        <a href={`/arquivos/recibo/${r.id}?vias=${vias === 2 ? 1 : 2}`} target="_blank" className={estilosBotao({ variante: "secundario", tamanho: "g" })}>
          <FileDown /> {vias === 2 ? "Uma via só" : "Duas vias"}
        </a>
        {sessao.papel === "gestora" && !cancelado ? <CancelarRecibo id={r.id} numero={numero} resumo={`${r.pagador} · ${brl(r.valor_centavos)}`} /> : null}
      </div>
    </div>
  );
}
