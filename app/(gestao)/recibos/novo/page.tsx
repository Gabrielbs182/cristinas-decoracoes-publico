import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FormRecibo } from "@/components/vendas/form-recibo";
import { exigirPapel } from "@/lib/auth";
import { numeroRecibo } from "@/lib/vendas/recibos";
import { hojeSP } from "@/lib/vendas/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Emitir recibo" };

export default async function EmitirRecibo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPapel("gestora");
  const p = await searchParams;
  const supabase = await criarClienteServidor();
  const [{ data: saldos }, { data: numeracao }, { data: empresa }] = await Promise.all([
    supabase.from("saldos_orcamentos").select("orcamento_id, numero, total_centavos, pago_centavos, saldo_centavos").gt("saldo_centavos", 0).order("numero", { ascending: false }),
    supabase.from("numeracao").select("proximo").eq("tipo", "recibo").maybeSingle(),
    supabase.from("empresa").select("nome_fantasia, razao_social, cnpj, telefone, cidade_uf").maybeSingle(),
  ]);
  const ids = (saldos ?? []).map((s) => s.orcamento_id!);
  const [{ data: orcs }, { data: ambientes }] = ids.length
    ? await Promise.all([
        supabase.from("orcamentos").select("id, clientes(nome)").in("id", ids),
        supabase.from("orcamento_ambientes").select("orcamento_id, nome, ordem").in("orcamento_id", ids).order("ordem"),
      ])
    : [{ data: [] }, { data: [] }];
  const orcamentos = (saldos ?? []).map((s) => ({
    id: s.orcamento_id!,
    numero: s.numero!,
    cliente: orcs?.find((o) => o.id === s.orcamento_id)?.clientes?.nome ?? "",
    ambientes: (ambientes ?? []).filter((a) => a.orcamento_id === s.orcamento_id).map((a) => a.nome),
    totalCentavos: s.total_centavos!,
    pagoCentavos: s.pago_centavos!,
    saldoCentavos: s.saldo_centavos!,
  }));
  const proximo = numeracao?.proximo ?? 1;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/recibos" className="flex items-center gap-1 self-start text-sm font-bold">
          <ChevronLeft className="size-4" /> Recibos
        </Link>
        <h1 className="font-display text-[30px] leading-tight font-medium">Emitir recibo nº {numeroRecibo(proximo)}</h1>
      </div>
      <FormRecibo
        orcamentos={orcamentos}
        inicial={typeof p.orcamento === "string" ? p.orcamento : null}
        proximo={proximo}
        hoje={hojeSP()}
        empresa={{
          nome: empresa?.nome_fantasia ?? "",
          razao_social: empresa?.razao_social ?? "",
          cnpj: empresa?.cnpj ?? "",
          telefone: empresa?.telefone ?? "",
          cidade_uf: empresa?.cidade_uf ?? "",
        }}
      />
    </>
  );
}
