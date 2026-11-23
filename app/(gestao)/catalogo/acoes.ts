"use server";

/** Catálogo de produtos e preços, modelos de confecção e regras de cálculo (só a gestora). */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";
import { exigirPapel } from "@/lib/auth";
import { CATEGORIAS } from "@/lib/vendas/calculo";
import { centavosDeTexto, cm2DeMetrosQuadrados, cmDeMetros, fatorDeTexto } from "@/lib/vendas/numeros";
import { criarClienteServidor } from "@/lib/supabase/server";

function falhou(e: unknown): RespostaAcao {
  return { ok: false, erro: e instanceof z.ZodError ? e.issues[0]!.message : e instanceof Error ? e.message : "Erro inesperado." };
}

const DINHEIRO = (rotulo: string) =>
  z
    .string()
    .transform((v) => centavosDeTexto(v))
    .refine((v): v is number => v !== null, `${rotulo}: use reais, como 89,90.`);

const PRODUTO = z.object({
  id: z.string().uuid().optional(),
  categoria: z.enum(["tecido", "persiana", "trilho", "acessorio", "servico"]),
  nome: z.string().trim().min(2, "Dê um nome ao produto.").max(120),
  preco: DINHEIRO("Preço"),
  porUnidade: z.boolean().optional(), // serviço: por unidade em vez de por vão
  larguraRolo: z.string().trim(),
});

function revalidar() {
  revalidatePath("/catalogo");
}

export async function salvarProduto(entrada: z.input<typeof PRODUTO>): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const p = PRODUTO.parse(entrada);
    const unidade = p.categoria === "servico" && p.porUnidade ? "un" : CATEGORIAS.find((c) => c.categoria === p.categoria)!.unidade;
    let largura_rolo_cm: number | null = null;
    if (p.categoria === "tecido" && p.larguraRolo) {
      largura_rolo_cm = cmDeMetros(p.larguraRolo);
      if (largura_rolo_cm === null || largura_rolo_cm < 50 || largura_rolo_cm > 600) return { ok: false, erro: "Largura do rolo em metros, entre 0,50 e 6,00." };
    }
    const linha = { categoria: p.categoria, nome: p.nome, unidade, preco_centavos: p.preco, largura_rolo_cm };
    const supabase = await criarClienteServidor();
    const { data, error } = p.id
      ? await supabase.from("produtos").update(linha).eq("id", p.id).select("id")
      : await supabase.from("produtos").insert(linha).select("id");
    if (error) return { ok: false, erro: error.code === "23505" ? "Já existe um produto com esse nome nesta categoria." : error.message };
    if (!data?.length) return { ok: false, erro: "Produto não encontrado." };
    revalidar();
    return { ok: true, mensagem: p.id ? "Produto atualizado" : "Produto cadastrado" };
  } catch (e) {
    return falhou(e);
  }
}

export async function definirProdutoAtivo(entrada: { id: string; ativo: boolean }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.from("produtos").update({ ativo: entrada.ativo }).eq("id", z.string().uuid().parse(entrada.id)).select("nome");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Produto não encontrado." };
    revalidar();
    return { ok: true, mensagem: `${data[0]!.nome}: ${entrada.ativo ? "ativo" : "inativo (some dos novos orçamentos)"}` };
  } catch (e) {
    return falhou(e);
  }
}

const MODELO = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Dê um nome ao modelo.").max(60),
  fator: z
    .string()
    .transform((v) => fatorDeTexto(v))
    .refine((v): v is number => v !== null, "Fator de franzimento entre 1,0 e 4,0 (ex.: 2,5)."),
  precoMetro: DINHEIRO("Confecção por metro"),
});

export async function salvarModelo(entrada: z.input<typeof MODELO>): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const m = MODELO.parse(entrada);
    const linha = { nome: m.nome, fator_franzimento: m.fator, preco_metro_centavos: m.precoMetro };
    const supabase = await criarClienteServidor();
    const { data, error } = m.id
      ? await supabase.from("modelos_confeccao").update(linha).eq("id", m.id).select("id")
      : await supabase.from("modelos_confeccao").insert(linha).select("id");
    if (error) return { ok: false, erro: error.code === "23505" ? "Já existe um modelo com esse nome." : error.message };
    if (!data?.length) return { ok: false, erro: "Modelo não encontrado." };
    revalidar();
    return { ok: true, mensagem: m.id ? "Modelo atualizado" : "Modelo cadastrado" };
  } catch (e) {
    return falhou(e);
  }
}

export async function definirModeloAtivo(entrada: { id: string; ativo: boolean }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.from("modelos_confeccao").update({ ativo: entrada.ativo }).eq("id", z.string().uuid().parse(entrada.id)).select("nome");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Modelo não encontrado." };
    revalidar();
    return { ok: true, mensagem: `${data[0]!.nome}: ${entrada.ativo ? "ativo" : "inativo"}` };
  } catch (e) {
    return falhou(e);
  }
}

export async function salvarRegrasOrcamento(entrada: { sobraTrilho: string; areaMinima: string }): Promise<RespostaAcao> {
  try {
    await exigirPapel("gestora");
    const sobra = cmDeMetros(entrada.sobraTrilho);
    const area = cm2DeMetrosQuadrados(entrada.areaMinima);
    if (sobra === null || sobra > 100) return { ok: false, erro: "Sobra do trilho em metros, até 1,00 (ex.: 0,20)." };
    if (area === null || area > 100000) return { ok: false, erro: "Área mínima em m², até 10,00 (ex.: 1,50)." };
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.from("regras_orcamento").update({ sobra_trilho_cm: sobra, area_minima_persiana_cm2: area }).eq("id", true).select("id");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Regras não encontradas." };
    revalidar();
    return { ok: true, mensagem: "Regras de cálculo salvas · valem para os próximos orçamentos" };
  } catch (e) {
    return falhou(e);
  }
}
