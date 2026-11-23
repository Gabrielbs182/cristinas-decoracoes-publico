import type { Metadata } from "next";

import { rotuloSemana } from "@/components/ponto/barra-semana";
import { PainelBanco } from "@/components/ponto/painel-banco";
import { TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { carregarBanco, regrasVigentes, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Banco de horas" };

export default async function PaginaBanco({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const atual = await semanaPadrao(supabase);
  const [bancos, regras, { f }] = await Promise.all([carregarBanco(supabase), regrasVigentes(supabase, atual), searchParams]);
  return (
    <>
      <TituloPagina contexto="Ponto e RH" titulo="Banco de horas" />
      <PainelBanco
        bancos={bancos}
        selecionadaId={f}
        base="/ponto/banco"
        corteMin={regras.horaCorteMin}
        toleranciaMin={regras.toleranciaCorteMin}
        ajuste={{ semanaRotulo: rotuloSemana(atual) }}
      />
    </>
  );
}
