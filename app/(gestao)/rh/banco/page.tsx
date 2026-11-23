import type { Metadata } from "next";

import { PainelBanco } from "@/components/ponto/painel-banco";
import { TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { carregarBanco, regrasVigentes, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Banco de horas" };

export default async function PaginaBancoContador({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await exigirPapel("contador", "gestora");
  const supabase = await criarClienteServidor();
  const [bancos, regras, { f }] = await Promise.all([
    carregarBanco(supabase),
    semanaPadrao(supabase).then((s) => regrasVigentes(supabase, s)),
    searchParams,
  ]);
  return (
    <>
      <TituloPagina contexto="Relatórios de RH" titulo="Saldos do banco de horas" />
      <PainelBanco bancos={bancos} selecionadaId={f} base="/rh/banco" corteMin={regras.horaCorteMin} toleranciaMin={regras.toleranciaCorteMin} />
    </>
  );
}
