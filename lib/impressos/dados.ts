/**
 * Fotografia de uma semana fechada, como ela foi gravada no fechamento — a fonte do espelho em PDF
 * e da planilha. Lida com a sessão do usuário: o RLS decide quem vem (gestora e contador: todas;
 * funcionária: só ela).
 */
import type { Regras } from "@/lib/ponto";
import { REGRAS_PADRAO } from "@/lib/ponto";
import type { Tables } from "@/lib/supabase/database.types";
import type { ClienteSupabase } from "@/lib/supabase/server";

export interface Empresa {
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  cidadeUf: string;
}

export interface EspelhoFuncionaria {
  id: string;
  nome: string;
  resultado: Tables<"semana_resultados">;
  dias: Tables<"semana_resultado_dias">[];
  ajustes: { minutos: number; motivo: string }[];
}

export interface FechamentoCarregado {
  segunda: string;
  fechadaEm: string | null;
  regras: Regras;
  empresa: Empresa;
  funcionarias: EspelhoFuncionaria[];
}

export async function carregarFechamento(supabase: ClienteSupabase, segunda: string, funcionariaId?: string): Promise<FechamentoCarregado | null> {
  let qRes = supabase.from("semana_resultados").select("*").eq("segunda", segunda);
  let qDias = supabase.from("semana_resultado_dias").select("*").eq("segunda", segunda).order("data");
  let qAju = supabase.from("ajustes_saldo").select("funcionaria_id, minutos, motivo").eq("segunda", segunda).order("criado_em");
  if (funcionariaId) {
    qRes = qRes.eq("funcionaria_id", funcionariaId);
    qDias = qDias.eq("funcionaria_id", funcionariaId);
    qAju = qAju.eq("funcionaria_id", funcionariaId);
  }
  const [rSem, rRes, rDias, rAju, rFun, rEmp] = await Promise.all([
    supabase.from("semanas").select("status, fechada_em, regras").eq("segunda", segunda).maybeSingle(),
    qRes,
    qDias,
    qAju,
    // Documento oficial (espelho, planilha do contador) sai com o nome do CADASTRO, que a gestora controla; o nome
    // que a funcionária escolhe fica nas telas (decisão de 25/10/2026: ele podia repetir o de uma colega).
    supabase.from("funcionarias").select("id, nome"),
    supabase.from("empresa").select("*").maybeSingle(),
  ]);
  if (rSem.data?.status !== "fechada" || !rRes.data?.length) return null;

  const nomes = new Map((rFun.data ?? []).map((f) => [f.id, f.nome]));
  const e = rEmp.data;
  return {
    segunda,
    fechadaEm: rSem.data.fechada_em,
    regras: { ...REGRAS_PADRAO, ...((rSem.data.regras as Partial<Regras> | null) ?? {}) },
    empresa: {
      nome: e?.nome_fantasia || "Cristina's Decorações",
      cnpj: e?.cnpj ?? "",
      telefone: e?.telefone ?? "",
      endereco: e?.endereco ?? "",
      cidadeUf: e?.cidade_uf ?? "",
    },
    funcionarias: rRes.data
      .map((r) => ({
        id: r.funcionaria_id,
        nome: nomes.get(r.funcionaria_id) ?? "—",
        resultado: r,
        dias: (rDias.data ?? []).filter((d) => d.funcionaria_id === r.funcionaria_id),
        ajustes: (rAju.data ?? []).filter((a) => a.funcionaria_id === r.funcionaria_id).map((a) => ({ minutos: a.minutos, motivo: a.motivo })),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}
