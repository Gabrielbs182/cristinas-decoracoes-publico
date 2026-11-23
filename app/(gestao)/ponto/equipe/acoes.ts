"use server";

/** Cadastro das funcionárias: nome, ID da catraca, jornada própria e desligamento. */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { bloquearLogin } from "@/lib/acessos";
import { exigirPapel } from "@/lib/auth";
import { minDeHhmm } from "@/lib/ponto";
import { criarClienteServidor } from "@/lib/supabase/server";

const HORAS = z
  .string()
  .trim()
  .refine((v) => v === "" || minDeHhmm(v) !== null, "Jornada em HH:MM (ex.: 09:00).");

const FUNCIONARIA = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome completo.").max(80),
  nomeExibicao: z.string().trim().min(2, "Informe como ela aparece no sistema.").max(40),
  enNo: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,9}$/.test(v), "O ID da catraca tem só números (até 9)."),
  cargaSegQui: HORAS,
  cargaSex: HORAS,
});

function falhou(e: unknown): RespostaAcao {
  return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
}

function revalidar() {
  revalidatePath("/ponto", "layout");
  revalidatePath("/configuracoes");
}

export async function salvarFuncionaria(entrada: z.input<typeof FUNCIONARIA>): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const f = FUNCIONARIA.parse(entrada);
    const enNo = f.enNo ? f.enNo.padStart(9, "0") : null;
    const cargas = {
      carga_seg_qui_min: f.cargaSegQui ? minDeHhmm(f.cargaSegQui) : null,
      carga_sex_min: f.cargaSex ? minDeHhmm(f.cargaSex) : null,
    };
    const supabase = await criarClienteServidor();

    if (enNo) {
      let dono = supabase.from("funcionarias").select("nome_exibicao").eq("en_no", enNo);
      if (f.id) dono = dono.neq("id", f.id);
      const { data: outra } = await dono.maybeSingle();
      if (outra) return { ok: false, erro: `O ID ${enNo} já é de ${outra.nome_exibicao}.` };
    }

    let id = f.id;
    if (id) {
      const { data: atual } = await supabase.from("funcionarias").select("en_no").eq("id", id).maybeSingle();
      if (!atual) return { ok: false, erro: "Funcionária não encontrada." };
      if (atual.en_no && atual.en_no !== enNo) return { ok: false, erro: "O ID da catraca já vinculado não muda por aqui." };
      const { error } = await supabase.from("funcionarias").update({ nome: f.nome, nome_exibicao: f.nomeExibicao, ...cargas }).eq("id", id);
      if (error) return { ok: false, erro: error.message };
      if (atual.en_no) id = undefined; // ID já vinculado: nada a adotar
    } else {
      const { data, error } = await supabase.from("funcionarias").insert({ nome: f.nome, nome_exibicao: f.nomeExibicao, ...cargas }).select("id").single();
      if (error) return { ok: false, erro: error.message };
      id = data.id;
    }

    // Vincular pelo banco adota as batidas que já chegaram com esse ID sem dona.
    let adotadas = 0;
    if (enNo && id) {
      const { data, error } = await supabase.rpc("vincular_id_catraca", { p_en_no: enNo, p_funcionaria: id });
      if (error) return { ok: false, erro: error.message };
      adotadas = data ?? 0;
    }
    revalidar();
    const extra = adotadas ? ` · ${adotadas} batida(s) que já estavam no sistema ficaram com ela` : "";
    return { ok: true, mensagem: `${f.id ? "Cadastro salvo" : "Funcionária cadastrada"}${extra}` };
  } catch (e) {
    return falhou(e);
  }
}

/** Desligar tira do ponto das próximas semanas e bloqueia o acesso; o histórico fica. */
export async function definirFuncionariaAtiva(entrada: { id: string; ativa: boolean }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const id = z.string().uuid().parse(entrada.id);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.from("funcionarias").update({ ativa: entrada.ativa }).eq("id", id).select("id");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Funcionária não encontrada." };

    let bloqueou = false;
    if (!entrada.ativa) {
      const { data: perfil } = await supabase.from("perfis").update({ ativo: false }).eq("funcionaria_id", id).eq("ativo", true).select("id");
      if (perfil?.length) {
        await bloquearLogin(perfil[0]!.id, true);
        bloqueou = true;
      }
    }
    revalidar();
    return { ok: true, mensagem: entrada.ativa ? "Funcionária reativada" : `Funcionária desligada${bloqueou ? " · acesso bloqueado" : ""}` };
  } catch (e) {
    return falhou(e);
  }
}
