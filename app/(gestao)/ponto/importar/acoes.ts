"use server";

/**
 * Importação do arquivo da catraca em duas etapas: prévia (não grava nada) e confirmação.
 * O mesmo arquivo pode ser importado de novo: batida já existente é ignorada (unique en_no+data+hora).
 * Batida de semana fechada não entra (o banco recusaria) e é contada à parte.
 */
import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPapel } from "@/lib/auth";
import { horaDeSeg, lerGlog, type LinhaComErro, segundaDe } from "@/lib/ponto";
import { carregarSemana } from "@/lib/ponto/servidor";
import { type ClienteSupabase, criarClienteServidor } from "@/lib/supabase/server";

const LIMITE_BYTES = 3 * 1024 * 1024;
const PAGINA = 1000; // max_rows da API

export interface Previa {
  arquivo: string;
  tamanhoKb: number;
  linhasLidas: number;
  batidasLidas: number;
  periodo: { inicio: string; fim: string };
  semanas: string[];
  novas: number;
  repetidas: number;
  emSemanaFechada: number;
  funcionarias: { enNo: string; nome: string; batidas: number; ativa: boolean }[];
  desconhecidos: { enNo: string; batidas: number; exemplo: string }[];
  erros: LinhaComErro[];
}

export interface ResumoImportacao {
  novas: number;
  semanas: { segunda: string; diasOk: number; bloqueios: number; avisos: number; corrigidos: number }[];
  semanasSemResumo: number;
}

type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string };

const chave = (enNo: string, data: string, horaSeg: number) => `${enNo}|${data}|${horaSeg}`;

async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGINA) return out;
  }
}

async function analisar(supabase: ClienteSupabase, arquivo: File) {
  if (arquivo.size > LIMITE_BYTES) throw new Error("Arquivo grande demais para um GLog (mais de 3 MB).");
  const conteudo = await arquivo.text();
  const leitura = lerGlog(conteudo);
  if (!leitura.batidas.length) {
    throw new Error("Nenhuma batida encontrada. Confira se é o arquivo da catraca (001_GLog.txt).");
  }

  const datas = leitura.batidas.map((b) => b.data).sort();
  const inicio = datas[0]!;
  const fim = datas[datas.length - 1]!;

  const [existentes, rFechadas, rFun] = await Promise.all([
    todas((de, ate) => supabase.from("batidas").select("en_no, data, hora_seg").gte("data", inicio).lte("data", fim).order("id").range(de, ate)),
    supabase.from("semanas").select("segunda").eq("status", "fechada").gte("segunda", segundaDe(inicio)).lte("segunda", fim),
    supabase.from("funcionarias").select("id, en_no, nome_exibicao, ativa"),
  ]);
  if (rFechadas.error || rFun.error) throw new Error((rFechadas.error ?? rFun.error)!.message);

  const jaExiste = new Set(existentes.map((b) => chave(b.en_no, b.data, b.hora_seg)));
  const fechadas = new Set((rFechadas.data ?? []).map((s) => s.segunda));
  const porEnNo = new Map((rFun.data ?? []).filter((f) => f.en_no).map((f) => [f.en_no!, f]));

  const vistas = new Set<string>();
  const novas: typeof leitura.batidas = [];
  let repetidas = 0;
  let emSemanaFechada = 0;
  for (const b of leitura.batidas) {
    const k = chave(b.enNo, b.data, b.horaSeg);
    if (jaExiste.has(k) || vistas.has(k)) {
      repetidas++;
      continue;
    }
    vistas.add(k);
    if (fechadas.has(segundaDe(b.data))) {
      emSemanaFechada++;
      continue;
    }
    novas.push(b);
  }

  const contagem = new Map<string, number>();
  for (const b of leitura.batidas) contagem.set(b.enNo, (contagem.get(b.enNo) ?? 0) + 1);

  const funcionarias: Previa["funcionarias"] = [];
  const desconhecidos: Previa["desconhecidos"] = [];
  for (const [enNo, n] of [...contagem].sort()) {
    const f = porEnNo.get(enNo);
    if (f) {
      funcionarias.push({ enNo, nome: f.nome_exibicao, batidas: n, ativa: f.ativa });
    } else {
      const delas = leitura.batidas.filter((b) => b.enNo === enNo);
      const d0 = delas[0]!.data;
      const doDia = delas.filter((b) => b.data === d0).map((b) => horaDeSeg(b.horaSeg));
      desconhecidos.push({ enNo, batidas: n, exemplo: `${doDia.length} batida(s) em ${d0.slice(8)}/${d0.slice(5, 7)} (${doDia.join(", ")})` });
    }
  }

  const previa: Previa = {
    arquivo: arquivo.name,
    tamanhoKb: Math.round((arquivo.size / 1024) * 10) / 10,
    linhasLidas: leitura.linhasLidas,
    batidasLidas: leitura.batidas.length,
    periodo: { inicio, fim },
    semanas: [...new Set(datas.map(segundaDe))],
    novas: novas.length,
    repetidas,
    emSemanaFechada,
    funcionarias,
    desconhecidos,
    erros: leitura.erros.slice(0, 50),
  };
  return { previa, novas, porEnNo, conteudo, erros: leitura.erros };
}

function arquivoDo(formData: FormData): File {
  const f = formData.get("arquivo");
  if (!(f instanceof File) || f.size === 0) throw new Error("Escolha o arquivo .txt da catraca.");
  return f;
}

export async function previaImportacao(formData: FormData): Promise<Resposta<Previa>> {
  try {
    await exigirPapel("gestora");
    const supabase = await criarClienteServidor();
    const { previa } = await analisar(supabase, arquivoDo(formData));
    return { ok: true, dados: previa };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao ler o arquivo." };
  }
}

const DECISOES = z.record(z.string().regex(/^\d{9}$/), z.union([z.literal("depois"), z.literal("ignorar"), z.string().uuid()]));

export async function confirmarImportacao(formData: FormData): Promise<Resposta<ResumoImportacao>> {
  try {
    const sessao = await exigirPapel("gestora");
    const supabase = await criarClienteServidor();
    const arquivo = arquivoDo(formData);
    const decisoes = DECISOES.parse(JSON.parse(String(formData.get("decisoes") ?? "{}")));
    const { previa, novas, porEnNo, conteudo, erros } = await analisar(supabase, arquivo);

    const { data: imp, error: eImp } = await supabase
      .from("importacoes")
      .insert({
        arquivo_nome: previa.arquivo,
        arquivo_sha256: createHash("sha256").update(conteudo).digest("hex"),
        periodo_inicio: previa.periodo.inicio,
        periodo_fim: previa.periodo.fim,
        linhas_lidas: previa.linhasLidas,
        batidas_novas: previa.novas,
        batidas_repetidas: previa.repetidas,
        batidas_semana_fechada: previa.emSemanaFechada,
        linhas_com_erro: erros.slice(0, 200) as never,
        importado_por: sessao.userId,
      })
      .select("id")
      .single();
    if (eImp) throw new Error(eImp.message);

    const { error: eSem } = await supabase
      .from("semanas")
      .upsert(previa.semanas.map((segunda) => ({ segunda })), { onConflict: "segunda", ignoreDuplicates: true });
    if (eSem) throw new Error(eSem.message);

    const linhas = novas.map((b) => ({
      en_no: b.enNo,
      funcionaria_id: porEnNo.get(b.enNo)?.id ?? null,
      data: b.data,
      hora_seg: b.horaSeg,
      iomd: b.iomd,
      importacao_id: imp.id,
    }));
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await supabase
        .from("batidas")
        .upsert(linhas.slice(i, i + 500), { onConflict: "en_no,data,hora_seg", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }

    // IDs desconhecidos: vincular adota as batidas recém-importadas; ignorar só registra a decisão.
    for (const [enNo, decisao] of Object.entries(decisoes)) {
      if (!previa.desconhecidos.some((d) => d.enNo === enNo) || decisao === "depois") continue;
      const { error } =
        decisao === "ignorar"
          ? await supabase.from("catraca_ids_ignorados").upsert({ en_no: enNo, motivo: `Ignorado na importação de ${previa.arquivo}`, autor: sessao.userId })
          : await supabase.rpc("vincular_id_catraca", { p_en_no: enNo, p_funcionaria: decisao });
      if (error) throw new Error(`ID ${enNo}: ${error.message}`);
    }

    // Resumo da validação das semanas mais recentes do arquivo.
    const recentes = [...previa.semanas].reverse().slice(0, 4);
    const semanas: ResumoImportacao["semanas"] = [];
    for (const segunda of recentes) {
      const s = await carregarSemana(supabase, segunda);
      const dias = s.funcionarias.flatMap((f) => f.resultado.dias.filter((d) => d.dow <= 5 && d.batidas.length));
      semanas.push({
        segunda,
        diasOk: dias.filter((d) => !d.pendencias.length).length,
        bloqueios: s.funcionarias.reduce((n, f) => n + f.resultado.bloqueios, 0) + s.idsDesconhecidos.length,
        avisos: s.funcionarias.reduce((n, f) => n + f.resultado.avisos, 0),
        corrigidos: dias.reduce((n, d) => n + d.batidas.filter((b) => b.tipoCorrigido).length, 0),
      });
    }

    revalidatePath("/ponto", "layout");
    revalidatePath("/inicio");
    return { ok: true, dados: { novas: previa.novas, semanas, semanasSemResumo: previa.semanas.length - recentes.length } };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao importar." };
  }
}
