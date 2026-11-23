"use server";

/** Cadastro de clientes (só a gestora; o RLS garante por baixo). */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { exigirPapel } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";

const TEXTO = (max: number) => z.string().trim().max(max, `No máximo ${max} caracteres.`);

const CLIENTE = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  telefone: TEXTO(30),
  email: TEXTO(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido."),
  documento: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 11 || v.length === 14, "CPF com 11 dígitos ou CNPJ com 14."),
  residenciaEndereco: TEXTO(200),
  residenciaBairro: TEXTO(80),
  residenciaCidade: TEXTO(80),
  obraNaResidencia: z.boolean(),
  obraEndereco: TEXTO(200),
  obraBairro: TEXTO(80),
  obraCidade: TEXTO(80),
  observacoes: TEXTO(1000),
});

export type EntradaCliente = z.input<typeof CLIENTE>;

function falhou(e: unknown): { ok: false; erro: string } {
  return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
}

export async function salvarCliente(entrada: EntradaCliente): Promise<RespostaAcao & { id?: string }> {
  try {
    await exigirPapel("gestora");
    const c = CLIENTE.parse(entrada);
    const linha = {
      nome: c.nome,
      telefone: c.telefone,
      email: c.email.toLowerCase(),
      documento: c.documento,
      residencia_endereco: c.residenciaEndereco,
      residencia_bairro: c.residenciaBairro,
      residencia_cidade: c.residenciaCidade,
      // Obra vazia = obra na residência.
      obra_endereco: c.obraNaResidencia ? "" : c.obraEndereco,
      obra_bairro: c.obraNaResidencia ? "" : c.obraBairro,
      obra_cidade: c.obraNaResidencia ? "" : c.obraCidade,
      observacoes: c.observacoes,
    };
    if (!c.obraNaResidencia && !c.obraEndereco) return { ok: false, erro: "Informe o endereço da obra ou marque que é na residência." };
    const supabase = await criarClienteServidor();
    const { data, error } = c.id
      ? await supabase.from("clientes").update(linha).eq("id", c.id).select("id").maybeSingle()
      : await supabase.from("clientes").insert(linha).select("id").single();
    if (error) return { ok: false, erro: error.message };
    if (!data) return { ok: false, erro: "Cliente não encontrado." };
    revalidatePath("/clientes", "layout");
    return { ok: true, mensagem: c.id ? "Cliente atualizado" : "Cliente cadastrado", id: data.id };
  } catch (e) {
    return falhou(e);
  }
}

export async function excluirCliente(entrada: { id: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const id = z.string().uuid().parse(entrada.id);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.from("clientes").delete().eq("id", id).select("id");
    // Com orçamentos (0.8), a chave estrangeira recusa a exclusão.
    if (error) return { ok: false, erro: error.code === "23503" ? "Este cliente tem orçamentos ou recibos e não pode ser excluído." : error.message };
    if (!data?.length) return { ok: false, erro: "Cliente não encontrado." };
    revalidatePath("/clientes", "layout");
  } catch (e) {
    return falhou(e);
  }
  redirect("/clientes");
}
