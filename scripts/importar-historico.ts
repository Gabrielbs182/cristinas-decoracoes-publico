/**
 * Importa o histórico do sistema antigo (relatórios semanais do projeto Pontos) como semanas FECHADAS.
 *
 *   python scripts/legado_historico.py ../Pontos/data/output > dados/historico-legado.json
 *   npx tsx --env-file=.env.development.local scripts/importar-historico.ts            # só confere
 *   npx tsx --env-file=.env.development.local scripts/importar-historico.ts --gravar   # grava
 *
 * Batidas: do GLog bruto quando ele existe para a semana (PONTOS_DIR, padrão ../Pontos); senão, dos
 * horários da própria planilha. Os números oficiais (K/L/M/N) são os do relatório da época.
 *
 * O plano simula o estado FINAL de cada semana e só grava se ele reproduzir a planilha:
 *   - dia em que o motor novo interpreta diferente da época → registra os tipos como foram apurados;
 *   - pendência que o motor novo aponta → registrada como resolvida "como foi apurado na época";
 *   - saldo que não encadeia com a semana anterior → ajuste manual com motivo.
 * Depois de gravar, relê tudo do banco, recalcula e confere com os resultados gravados.
 *
 * Motivos conhecidos das quebras de saldo vêm de dados/historico-motivos.json (fora do git, cita nomes):
 *   { "<segunda YYYY-MM-DD>|<nome de exibição>": "motivo" }
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  avaliarSemana,
  dataBr,
  diasDaSemana,
  hhmm,
  type Lancamento,
  lerGlog,
  minDeHhmm,
  type Ocorrencia,
  REGRAS_PADRAO,
  type ResultadoSemana,
  segundaDe,
  type TipoBatida,
} from "../lib/ponto";
import { lancamentoDaLinha } from "../lib/ponto/linhas";
import type { Database } from "../lib/supabase/database.types";

const GRAVAR = process.argv.includes("--gravar");
const GESTORA = process.argv.find((a) => a.startsWith("--gestora="))?.slice(10) ?? "cristina";
const PONTOS = process.env.PONTOS_DIR ?? path.resolve("..", "Pontos");
const dominio = process.env.USUARIOS_DOMINIO_INTERNO ?? "usuarios.cristinas.invalid";
const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

interface DiaLegado {
  data: string;
  funcionario: string;
  entrada: string | null;
  saida_almoco: string | null;
  volta_almoco: string | null;
  saida: string | null;
  trab: string | null;
  extra: string | null;
}
interface SemanaLegado {
  segunda: string;
  arquivo: string;
  gerado_em: string;
  dias: DiaLegado[];
  resumo: { funcionario: string; k: string; l: string; m: string; n: string }[];
}
interface Funcionaria {
  id: string;
  en_no: string | null;
  nome_exibicao: string;
}
interface Batida {
  id: number;
  en_no: string;
  funcionaria_id: string;
  data: string;
  hora_seg: number;
  iomd: number | null;
}
/** Lançamento a gravar (sem id/autor), com o equivalente do motor para simular. */
interface LancamentoNovo {
  funcionaria_id: string;
  data: string;
  tipo: "trocar_tipo" | "resolver_pendencia" | "ocorrencia";
  batida_id?: number;
  ocorrencia?: Ocorrencia;
  tipo_batida?: TipoBatida;
  pendencia_codigo?: string;
  assinatura?: string;
  motivo: string;
}

/** "07:01" → minutos; "Falta"/vazio → null. Aceita sinal. */
const min = (s: string | null) => (!s || s === "Falta" ? null : s.startsWith("-") ? -minDeHhmm(s.slice(1))! : minDeHhmm(s)!);
const falha = (msg: string): never => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

let idSimulado = 1_000_000_000;
const paraMotor = (l: LancamentoNovo): Lancamento & { data: string } => {
  const base = { id: idSimulado++, data: l.data, motivo: l.motivo, criadoEm: "" };
  if (l.tipo === "trocar_tipo") return { ...base, tipo: "trocar_tipo", alvo: { batidaId: l.batida_id! }, tipoBatida: l.tipo_batida! };
  if (l.tipo === "ocorrencia") return { ...base, tipo: "ocorrencia", ocorrencia: l.ocorrencia! };
  return { ...base, tipo: "resolver_pendencia", codigo: l.pendencia_codigo as never, assinatura: l.assinatura! };
};

const HORA = /^\d{2}:\d{2}$/;
/**
 * Dia anotado à mão na planilha antiga (ex.: "Justificado" no lugar dos horários).
 * No sistema novo isso é uma ocorrência: atestado ou falta justificada.
 */
function anotacao(d: DiaLegado): Ocorrencia | null {
  if (!d.trab || d.trab === "Falta" || HORA.test(d.trab)) return null;
  return /atestado/i.test(d.trab) ? "atestado" : "falta_justificada";
}

function avaliar(s: SemanaLegado, f: Funcionaria, batidas: Batida[], lancamentos: LancamentoNovo[], feriados: Record<string, string>): ResultadoSemana {
  return avaliarSemana({
    segunda: s.segunda,
    regras: REGRAS_PADRAO,
    feriados,
    batidas: batidas.filter((b) => b.funcionaria_id === f.id).map((b) => ({ id: b.id, data: b.data, horaSeg: b.hora_seg, iomd: b.iomd })),
    lancamentos: lancamentos.filter((l) => l.funcionaria_id === f.id).map(paraMotor),
    saldoAnteriorMin: 0,
  });
}

/** Dias em que a conta do motor não bate com a planilha. */
function divergentes(s: SemanaLegado, nome: string, r: ResultadoSemana) {
  return s.dias
    .filter((d) => d.funcionario === nome)
    .filter((d) => {
      const dia = r.dias.find((x) => x.data === d.data)!;
      // Dia anotado: a planilha não tem horas; o que importa é a ocorrência e a extra (zero).
      const oc = anotacao(d);
      if (oc) return dia.situacao !== oc || dia.extraMin !== (min(d.extra) ?? 0);
      return dia.trabalhadasMin !== min(d.trab) || dia.extraMin !== (min(d.extra) ?? 0);
    });
}

/** Estado final da semana para uma funcionária: tipos "como na época" + resoluções, conferido com a planilha. */
function planejar(s: SemanaLegado, f: Funcionaria, batidas: Batida[], feriados: Record<string, string>) {
  const motivoTipo = `Histórico do sistema antigo: batidas classificadas como no relatório da semana (${s.arquivo}).`;
  const motivoPend = `Histórico do sistema antigo: apurado assim no relatório da semana (${s.arquivo}).`;
  const lancs: LancamentoNovo[] = [];

  // 0) Dia anotado à mão ("Justificado") vira a ocorrência correspondente.
  for (const d of s.dias.filter((x) => x.funcionario === f.nome_exibicao)) {
    const oc = anotacao(d);
    if (oc) {
      lancs.push({
        funcionaria_id: f.id,
        data: d.data,
        tipo: "ocorrencia",
        ocorrencia: oc,
        motivo: `Histórico do sistema antigo: dia marcado como "${d.trab}" na planilha da semana (${s.arquivo}).`,
      });
    }
  }

  // 1) Onde a interpretação mudou, registra a da época (posição: entrada, saída almoço, volta, saída).
  for (const d of divergentes(s, f.nome_exibicao, avaliar(s, f, batidas, lancs, feriados))) {
    const doDia = batidas.filter((b) => b.funcionaria_id === f.id && b.data === d.data).sort((a, b) => a.hora_seg - b.hora_seg);
    doDia.slice(0, 4).forEach((b, i) =>
      lancs.push({ funcionaria_id: f.id, data: d.data, tipo: "trocar_tipo", batida_id: b.id, tipo_batida: (["E", "A", "V", "S"] as const)[i], motivo: motivoTipo }),
    );
  }

  // 2) O que o motor ainda aponta fica resolvido como foi apurado na época.
  const comTipos = avaliar(s, f, batidas, lancs, feriados);
  for (const d of comTipos.dias) {
    for (const p of d.pendencias) {
      lancs.push({ funcionaria_id: f.id, data: d.data, tipo: "resolver_pendencia", pendencia_codigo: p.codigo, assinatura: d.assinatura, motivo: motivoPend });
    }
  }

  const final = avaliar(s, f, batidas, lancs, feriados);
  const problemas = divergentes(s, f.nome_exibicao, final).map((d) => {
    const dia = final.dias.find((x) => x.data === d.data)!;
    return `${dataBr(d.data)} ${f.nome_exibicao}: planilha ${d.trab}/+${d.extra} · motor ${dia.trabalhadasMin === null ? "Falta" : hhmm(dia.trabalhadasMin)}/+${hhmm(dia.extraMin)}`;
  });
  const l = min(s.resumo.find((x) => x.funcionario === f.nome_exibicao)!.l) ?? 0;
  if (final.banco.extrasSemanaMin !== l) problemas.push(`semana ${dataBr(s.segunda)} ${f.nome_exibicao}: L planilha ${hhmm(l)} · motor ${hhmm(final.banco.extrasSemanaMin)}`);
  if (final.bloqueios + final.avisos) problemas.push(`semana ${dataBr(s.segunda)} ${f.nome_exibicao}: ${final.bloqueios + final.avisos} pendência(s) continuam abertas`);
  return { lancs, final, problemas, trocas: lancs.filter((x) => x.tipo === "trocar_tipo").length };
}

async function main() {
  const historico: SemanaLegado[] = JSON.parse(readFileSync("dados/historico-legado.json", "utf-8"));
  const motivos: Record<string, string> = existsSync("dados/historico-motivos.json")
    ? JSON.parse(readFileSync("dados/historico-motivos.json", "utf-8"))
    : {};
  const motivoQuebra = (segunda: string, nome: string, k: number, anterior: number) =>
    motivos[`${segunda}|${nome}`] ?? `Ajuste manual feito no sistema antigo: o saldo desta semana começou em ${hhmm(k)}, mas a anterior terminou em ${hhmm(anterior)}.`;
  const { data: funcionarias } = await admin.from("funcionarias").select("id, en_no, nome_exibicao");
  const porNome = new Map((funcionarias ?? []).map((f) => [f.nome_exibicao, f]));
  const porEnNo = new Map((funcionarias ?? []).map((f) => [f.en_no, f]));
  const { data: feriadosRows } = await admin.from("feriados").select("data, nome");
  const feriados = Object.fromEntries((feriadosRows ?? []).map((f) => [f.data, f.nome]));

  // GLog brutos disponíveis, por semana (só arquivos que cobrem uma semana inteira só).
  const brutos = new Map<string, { arquivo: string; conteudo: string; batidas: ReturnType<typeof lerGlog>["batidas"] }>();
  for (const arq of [path.join(PONTOS, "pontos.txt"), path.join(PONTOS, "data", "input", "001_GLog.txt")]) {
    if (!existsSync(arq)) continue;
    const conteudo = readFileSync(arq, "utf-8");
    const { batidas } = lerGlog(conteudo);
    const semanas = new Set(batidas.map((b) => segundaDe(b.data)));
    if (semanas.size === 1) brutos.set([...semanas][0]!, { arquivo: path.basename(arq), conteudo, batidas });
  }

  const batidasDaSemana = (s: SemanaLegado): Omit<Batida, "id">[] => {
    const bruto = brutos.get(s.segunda);
    if (bruto) {
      return bruto.batidas.flatMap((b) => {
        const f = porEnNo.get(b.enNo);
        return f ? [{ en_no: b.enNo, funcionaria_id: f.id, data: b.data, hora_seg: b.horaSeg, iomd: b.iomd }] : [];
      });
    }
    return s.dias.flatMap((d) => {
      const f = porNome.get(d.funcionario)!;
      return [d.entrada, d.saida_almoco, d.volta_almoco, d.saida].flatMap((h) => {
        const m = min(h);
        return m === null ? [] : [{ en_no: f.en_no!, funcionaria_id: f.id, data: d.data, hora_seg: m * 60, iomd: null }];
      });
    });
  };

  // ---------------------------------------------------------------- conferência
  let idBatida = 1;
  const problemas: string[] = [];
  const contagem = new Map<string, number>();
  let trocas = 0;
  let nAnterior = new Map<string, number>();
  for (const s of historico) {
    for (const r of s.resumo) if (!porNome.has(r.funcionario)) falha(`Funcionária "${r.funcionario}" (${s.arquivo}) não está cadastrada. Rode o seed-dev com dados/funcionarias.csv.`);
    const batidas = batidasDaSemana(s).map((b) => ({ ...b, id: idBatida++ }));
    for (const res of s.resumo) {
      const f = porNome.get(res.funcionario)!;
      const p = planejar(s, f, batidas, feriados);
      problemas.push(...p.problemas);
      trocas += p.trocas;
      const semTipos = avaliar(s, f, batidas, p.lancs.filter((x) => x.tipo === "trocar_tipo"), feriados);
      for (const q of semTipos.dias.flatMap((d) => d.pendencias)) contagem.set(`${q.severidade} · ${q.titulo}`, (contagem.get(`${q.severidade} · ${q.titulo}`) ?? 0) + 1);
      const ant = nAnterior.get(f.id);
      const k = min(res.k) ?? 0;
      if (ant !== undefined && ant !== k)
        console.log(`  ↪ ${dataBr(s.segunda)} ${f.nome_exibicao}: ajuste de ${hhmm(k - ant)} — ${motivoQuebra(s.segunda, f.nome_exibicao, k, ant)}`);
    }
    nAnterior = new Map(s.resumo.map((r) => [porNome.get(r.funcionario)!.id, min(r.n) ?? 0]));
  }

  const ultima = historico.at(-1)!;
  console.log(`\n${historico.length} semanas (${dataBr(historico[0]!.segunda)} a ${dataBr(ultima.segunda)}), ${idBatida - 1} batidas.`);
  console.log(`Fonte: ${[...brutos].map(([seg, b]) => `${dataBr(seg)} ← ${b.arquivo}`).join("; ")}; o resto ← horários da planilha.`);
  console.log(`Dias em que a interpretação da época foi registrada (tipos das batidas): ${trocas / 4 || 0}`);
  const anotados = historico.flatMap((s) => s.dias.filter((d) => anotacao(d)).map((d) => `${dataBr(d.data)} ${d.funcionario} ("${d.trab}")`));
  console.log(`Dias anotados à mão na planilha, registrados como ocorrência: ${anotados.length ? anotados.join(", ") : "nenhum"}`);
  console.log(`Pendências que o motor novo aponta no histórico (ficam como apuradas na época): ${[...contagem.values()].reduce((a, b) => a + b, 0)}`);
  for (const [k, v] of [...contagem].sort((a, b) => b[1] - a[1])) console.log(`  ${v}× ${k}`);
  console.log(`Saldo atual (N de ${dataBr(ultima.segunda)}): ${ultima.resumo.map((r) => `${r.funcionario} ${r.n}`).join(" · ")}`);
  if (problemas.length) {
    for (const p of problemas) console.log(`  ≠ ${p}`);
    falha(`${problemas.length} divergência(s) com as planilhas. Nada foi gravado.`);
  }
  console.log("Conferência com as planilhas: estado final 100% igual, sem pendência aberta.");
  if (!GRAVAR) {
    console.log("\nRode com --gravar para importar.");
    return;
  }

  // ---------------------------------------------------------------- gravação
  const { data: fechadas } = await admin.from("semanas").select("segunda").eq("status", "fechada");
  if (fechadas?.length) falha(`Já existem ${fechadas.length} semana(s) fechada(s). O histórico só entra num banco sem fechamentos.`);
  const fim = diasDaSemana(ultima.segunda)[6]!;
  const { data: existentes } = await admin.from("batidas").select("id").gte("data", historico[0]!.segunda).lte("data", fim).limit(1);
  if (existentes?.length) falha("Já existem batidas no período do histórico. Importe num banco limpo (npx supabase db reset + seed-dev).");

  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const gestora = lista?.users.find((u) => u.email === (GESTORA.includes("@") ? GESTORA : `${GESTORA}@${dominio}`));
  if (!gestora) return falha(`Gestora "${GESTORA}" não encontrada (use --gestora=<login>).`);
  const autor = gestora.id;

  const json = readFileSync("dados/historico-legado.json");
  const { data: impHist, error: eImp } = await admin
    .from("importacoes")
    .insert({
      arquivo_nome: `Histórico do sistema antigo (${historico.length} relatórios semanais)`,
      arquivo_sha256: createHash("sha256").update(json).digest("hex"),
      periodo_inicio: historico[0]!.segunda,
      periodo_fim: diasDaSemana(ultima.segunda)[4]!,
      linhas_lidas: historico.reduce((n, s) => n + s.dias.length, 0),
      batidas_novas: 0,
      batidas_repetidas: 0,
      importado_por: autor,
    })
    .select("id")
    .single();
  if (eImp) falha(eImp.message);

  let totalPlanilha = 0;
  nAnterior = new Map();
  for (const s of historico) {
    const quando = new Date(s.gerado_em).toISOString();
    const bruto = brutos.get(s.segunda);
    let importacaoId = impHist!.id;
    if (bruto) {
      const { data: imp, error } = await admin
        .from("importacoes")
        .insert({
          arquivo_nome: bruto.arquivo,
          arquivo_sha256: createHash("sha256").update(bruto.conteudo).digest("hex"),
          periodo_inicio: s.segunda,
          periodo_fim: diasDaSemana(s.segunda)[6]!,
          linhas_lidas: bruto.batidas.length,
          batidas_novas: bruto.batidas.length,
          batidas_repetidas: 0,
          importado_por: autor,
        })
        .select("id")
        .single();
      if (error) falha(error.message);
      importacaoId = imp!.id;
    }

    const { error: eSem } = await admin.from("semanas").upsert({ segunda: s.segunda, status: "aberta" });
    if (eSem) falha(eSem.message);
    const novas = batidasDaSemana(s);
    if (!bruto) totalPlanilha += novas.length;
    const { data: gravadas, error: eBat } = await admin
      .from("batidas")
      .insert(novas.map((b) => ({ ...b, importacao_id: importacaoId })))
      .select("id, en_no, funcionaria_id, data, hora_seg, iomd");
    if (eBat) falha(`batidas de ${s.segunda}: ${eBat.message}`);
    const batidas = gravadas!.map((b) => ({ ...b, funcionaria_id: b.funcionaria_id! }));

    const resultados = [];
    const dias = [];
    for (const res of s.resumo) {
      const f = porNome.get(res.funcionario)!;
      const { lancs, final } = planejar(s, f, batidas, feriados);
      if (lancs.length) {
        const { error } = await admin.from("ponto_lancamentos").insert(lancs.map((l) => ({ ...l, autor, criado_em: quando })));
        if (error) falha(`lançamentos de ${s.segunda}: ${error.message}`);
      }

      const k = min(res.k) ?? 0;
      const anterior = nAnterior.get(f.id) ?? 0;
      const ajuste = k - anterior;
      if (ajuste) {
        const { error } = await admin.from("ajustes_saldo").insert({
          funcionaria_id: f.id,
          segunda: s.segunda,
          minutos: ajuste,
          motivo: nAnterior.has(f.id)
            ? motivoQuebra(s.segunda, f.nome_exibicao, k, anterior)
            : `Saldo inicial vindo do sistema antigo (relatório de ${dataBr(s.segunda)}).`,
          autor,
          criado_em: quando,
        });
        if (error) falha(`ajuste de ${s.segunda}: ${error.message}`);
      }

      const m = min(res.m) ?? 0;
      const legadoDela = s.dias.filter((d) => d.funcionario === f.nome_exibicao);
      resultados.push({
        segunda: s.segunda,
        funcionaria_id: f.id,
        saldo_anterior_min: anterior,
        extras_semana_min: min(res.l) ?? 0,
        ajustes_min: ajuste,
        acumulado_min: m,
        fechou_corte: m >= REGRAS_PADRAO.horaCorteMin - REGRAS_PADRAO.toleranciaCorteMin,
        proxima_semana_min: min(res.n) ?? 0,
        trabalhadas_min: legadoDela.reduce((t, d) => t + (min(d.trab) ?? 0), 0),
        dias_trabalhados: legadoDela.filter((d) => (min(d.trab) ?? 0) > 0).length,
      });
      for (const d of legadoDela) {
        const dia = final.dias.find((x) => x.data === d.data)!;
        // Só horário vai para coluna de horário (anotação como "Justificado" vira ocorrência).
        const sem = (h: string | null) => (h && HORA.test(h) ? h : null);
        dias.push({
          segunda: s.segunda,
          funcionaria_id: f.id,
          data: d.data,
          entrada: sem(d.entrada),
          saida_almoco: sem(d.saida_almoco),
          volta_almoco: sem(d.volta_almoco),
          saida: sem(d.saida),
          trabalhadas_min: min(d.trab),
          extra_min: min(d.extra) ?? 0,
          situacao: dia.situacao,
          ajustado: dia.ajustado,
        });
      }
    }
    nAnterior = new Map(s.resumo.map((r) => [porNome.get(r.funcionario)!.id, min(r.n) ?? 0]));

    const { error: eRes } = await admin.from("semana_resultados").insert(resultados);
    if (eRes) falha(`resultados de ${s.segunda}: ${eRes.message}`);
    const { error: eDias } = await admin.from("semana_resultado_dias").insert(dias);
    if (eDias) falha(`dias de ${s.segunda}: ${eDias.message}`);
    const { error: eFecha } = await admin
      .from("semanas")
      .update({ status: "fechada", fechada_em: quando, fechada_por: autor, regras: REGRAS_PADRAO as never })
      .eq("segunda", s.segunda);
    if (eFecha) falha(eFecha.message);
    const { error: eEv } = await admin
      .from("semana_eventos")
      .insert({ segunda: s.segunda, acao: "fechar", motivo: `Importada do relatório do sistema antigo (${s.arquivo}).`, autor, em: quando });
    if (eEv) falha(eEv.message);
    process.stdout.write(".");
  }
  await admin.from("importacoes").update({ batidas_novas: totalPlanilha }).eq("id", impHist!.id);

  // ---------------------------------------------------------------- verificação pós-gravação
  // Relê do banco e recalcula tudo como a tela faz (saldo anterior = N gravado da semana anterior).
  let saldo = new Map<string, number>();
  let conferidas = 0;
  for (const s of historico) {
    const fimSem = diasDaSemana(s.segunda)[6]!;
    const [{ data: bat }, { data: lan }, { data: aju }, { data: res }] = await Promise.all([
      admin.from("batidas").select("id, funcionaria_id, data, hora_seg, iomd").gte("data", s.segunda).lte("data", fimSem),
      admin.from("ponto_lancamentos").select("*").gte("data", s.segunda).lte("data", fimSem),
      admin.from("ajustes_saldo").select("funcionaria_id, minutos").eq("segunda", s.segunda),
      admin.from("semana_resultados").select("*").eq("segunda", s.segunda),
    ]);
    for (const r of res ?? []) {
      const calc = avaliarSemana({
        segunda: s.segunda,
        regras: REGRAS_PADRAO,
        feriados,
        batidas: (bat ?? []).filter((b) => b.funcionaria_id === r.funcionaria_id).map((b) => ({ id: b.id, data: b.data, horaSeg: b.hora_seg, iomd: b.iomd })),
        lancamentos: (lan ?? []).filter((l) => l.funcionaria_id === r.funcionaria_id).map((l) => lancamentoDaLinha(l, new Map())),
        saldoAnteriorMin: saldo.get(r.funcionaria_id) ?? 0,
        ajustesMin: (aju ?? []).filter((a) => a.funcionaria_id === r.funcionaria_id).reduce((t, a) => t + a.minutos, 0),
      });
      const b = calc.banco;
      if (b.acumuladoMin !== r.acumulado_min || b.proximaSemanaMin !== r.proxima_semana_min || b.fechouCorte !== r.fechou_corte || calc.bloqueios + calc.avisos) {
        falha(`Verificação: semana ${dataBr(s.segunda)} recalculada não bate com o gravado (acumulado ${hhmm(b.acumuladoMin)} × ${hhmm(r.acumulado_min)}).`);
      }
      conferidas++;
    }
    saldo = new Map((res ?? []).map((r) => [r.funcionaria_id, r.proxima_semana_min]));
  }
  console.log(`\n✓ ${historico.length} semanas importadas e fechadas. Verificação: ${conferidas} semanas-funcionária recalculadas do banco, todas iguais ao relatório.`);
}

main().catch((e) => falha(e instanceof Error ? e.message : String(e)));
