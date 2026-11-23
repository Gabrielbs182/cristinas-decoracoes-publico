import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FormCorrecao } from "@/components/portal/form-correcao";
import { TituloPortal } from "@/components/portal/titulo";
import { exigirPapel } from "@/lib/auth";
import { diaMes, isoDow, NOME_DIA, somarDias, type TipoBatida } from "@/lib/ponto";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pedir correção" };

/** Até onde dá para voltar quando nenhuma semana foi fechada ainda. */
const JANELA_DIAS = 41;

export default async function PedirCorrecao({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPapel("funcionaria");
  const params = await searchParams;
  const supabase = await criarClienteServidor();
  const { data: ultimaFechada } = await supabase.from("semanas").select("segunda").eq("status", "fechada").order("segunda", { ascending: false }).limit(1).maybeSingle();

  // Dias que ainda aceitam pedido: depois da última semana fechada e até hoje (domingo não tem expediente).
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const limite = somarDias(hoje, -JANELA_DIAS);
  const inicio = ultimaFechada && somarDias(ultimaFechada.segunda, 7) > limite ? somarDias(ultimaFechada.segunda, 7) : limite;
  const dias: { valor: string; rotulo: string }[] = [];
  for (let d = hoje; d >= inicio; d = somarDias(d, -1)) {
    if (isoDow(d) !== 7) dias.push({ valor: d, rotulo: `${NOME_DIA[isoDow(d)]!.replace("-feira", "")}, ${diaMes(d)}` });
  }

  const dia = typeof params.dia === "string" && dias.some((d) => d.valor === params.dia) ? params.dia : (dias[0]?.valor ?? "");
  const tipo = typeof params.tipo === "string" && ["E", "A", "V", "S"].includes(params.tipo) ? (params.tipo as TipoBatida) : null;

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href="/meu-ponto/pendencias" aria-label="Voltar" className="grid size-11 flex-none place-items-center rounded-[10px] border border-borda-campo bg-superficie">
          <ChevronLeft className="size-5" />
        </Link>
        <TituloPortal contexto="Pedido para a gestora" titulo="Pedir correção" />
      </div>
      {dias.length ? (
        <FormCorrecao dias={dias} diaInicial={dia} tipoInicial={tipo} />
      ) : (
        <div className="rounded-xl border border-dashed border-tracejado bg-superficie p-6 text-center text-sm text-tinta-3">
          Não há dias em aberto para pedir correção. Fale com a gestora.
        </div>
      )}
    </>
  );
}
