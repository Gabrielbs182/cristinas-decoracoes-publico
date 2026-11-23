/**
 * Carrega uma semana do banco e passa pelo motor. Roda com a sessão do usuário: o RLS decide
 * o que vem (gestora: todas; funcionária: só ela). Nada aqui usa a chave secreta.
 */
import "server-only";

import type { ClienteSupabase } from "@/lib/supabase/server";

import { avaliarSemana, type Lancamento, type ResultadoSemana } from "./index";
import { lancamentoDaLinha, regrasDaLinha } from "./linhas";
import { type PendenciaDaFuncionaria, pendenciasParaFuncionaria } from "./solicitacoes";
import { REGRAS_PADRAO, type Regras } from "./regras";
import { segundaDe, somarDias } from "./tempo";

export interface FuncionariaSemana {
  id: string;
  nome: string;
  nomeExibicao: string;
  enNo: string | null;
  resultado: ResultadoSemana;
  /** Diário da semana dela (para o histórico de cada dia). */
  lancamentos: (Lancamento & { data: string })[];
  /** Saldo anterior vem de semana que ainda não foi fechada: pode mudar. */
  saldoProvisorio: boolean;
}

export interface IdDesconhecido {
  enNo: string;
  batidas: number;
  dias: string[];
}

export interface SemanaCarregada {
  segunda: string;
  status: "aberta" | "fechada";
  fechadaEm: string | null;
  regras: Regras;
  feriados: Record<string, string>;
  funcionarias: FuncionariaSemana[];
  idsDesconhecidos: IdDesconhecido[];
  temBatidas: boolean;
}


export async function regrasVigentes(supabase: ClienteSupabase, segunda: string): Promise<Regras> {
  const { data } = await supabase
    .from("regras_ponto")
    .select("*")
    .lte("vigente_desde", segunda)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? regrasDaLinha(data) : REGRAS_PADRAO;
}


/**
 * A semana em que se trabalha agora: a mais recente com batida, se ainda estiver aberta; senão, a
 * seguinte à última fechada (é ela que recebe o saldo atual). Sem nada no banco, a semana de hoje.
 */
export async function semanaPadrao(supabase: ClienteSupabase): Promise<string> {
  const [{ data: ultimaBatida }, { data: ultimaFechada }] = await Promise.all([
    supabase.from("batidas").select("data").order("data", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("semanas").select("segunda").eq("status", "fechada").order("segunda", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const comBatida = ultimaBatida ? segundaDe(ultimaBatida.data) : null;
  if (comBatida && (!ultimaFechada || comBatida > ultimaFechada.segunda)) return comBatida;
  if (ultimaFechada) return somarDias(ultimaFechada.segunda, 7);
  return segundaDe(new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
}

export interface PendenciaDoPortal extends PendenciaDaFuncionaria {
  /** Ela já pediu correção deste dia e a gestora ainda não respondeu. */
  pedidoEnviado: boolean;
}

/** Pendências que bloqueiam nas semanas abertas da funcionária (com a sessão dela: o RLS só devolve o que é dela). */
export async function pendenciasAbertasDaFuncionaria(supabase: ClienteSupabase, funcionariaId: string): Promise<PendenciaDoPortal[]> {
  const [{ data: abertas }, { data: pedidos }] = await Promise.all([
    supabase.from("semanas").select("segunda").eq("status", "aberta").order("segunda", { ascending: false }).limit(4),
    supabase.from("solicitacoes_correcao").select("data").eq("status", "pendente").eq("funcionaria_id", funcionariaId),
  ]);
  const comPedido = new Set((pedidos ?? []).map((p) => p.data));
  const out: PendenciaDoPortal[] = [];
  for (const s of abertas ?? []) {
    const semana = await carregarSemana(supabase, s.segunda, { funcionariaId });
    const eu = semana.funcionarias[0];
    if (!eu || !semana.temBatidas) continue;
    out.push(...pendenciasParaFuncionaria(eu.resultado.dias).map((p) => ({ ...p, pedidoEnviado: comPedido.has(p.data) })));
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

/** Primeira semana aberta, anterior a esta, que tem batida (impede fechar fora de ordem). */
export async function semanaAbertaAnterior(supabase: ClienteSupabase, segunda: string): Promise<string | null> {
  const { data: abertas } = await supabase.from("semanas").select("segunda").eq("status", "aberta").lt("segunda", segunda).order("segunda");
  for (const s of abertas ?? []) {
    const { count } = await supabase
      .from("batidas")
      .select("id", { count: "exact", head: true })
      .gte("data", s.segunda)
      .lte("data", somarDias(s.segunda, 6));
    if (count) return s.segunda;
  }
  return null;
}

export interface SemanaDoBanco {
  segunda: string;
  saldoAnteriorMin: number;
  extrasMin: number;
  ajustesMin: number;
  acumuladoMin: number;
  fechouCorte: boolean;
  segueMin: number;
}

export interface BancoDaFuncionaria {
  id: string;
  nomeExibicao: string;
  /** Saldo que segue do último fechamento, mais ajustes já lançados em semana aberta. */
  saldoAtualMin: number;
  /** Ajustes lançados depois do último fechamento (entram oficialmente quando a semana fechar). */
  ajustesPendentesMin: number;
  fechadoAte: string | null;
  semanas: SemanaDoBanco[];
  ajustes: { segunda: string; minutos: number; motivo: string; criadoEm: string }[];
}

/** Histórico oficial do banco (semanas fechadas) por funcionária. Gestora e contador leem tudo; funcionária, só o dela. */
export async function carregarBanco(supabase: ClienteSupabase): Promise<BancoDaFuncionaria[]> {
  const [rFun, rRes, rAju] = await Promise.all([
    supabase.from("funcionarias").select("id, nome_exibicao").eq("ativa", true).order("nome_exibicao"),
    supabase.from("semana_resultados").select("*").order("segunda"),
    supabase.from("ajustes_saldo").select("funcionaria_id, segunda, minutos, motivo, criado_em").order("criado_em"),
  ]);
  for (const r of [rFun, rRes, rAju]) if (r.error) throw new Error(`Falha ao carregar o banco de horas: ${r.error.message}`);
  return (rFun.data ?? []).map((f) => {
    const semanas = (rRes.data ?? [])
      .filter((r) => r.funcionaria_id === f.id)
      .map((r) => ({
        segunda: r.segunda,
        saldoAnteriorMin: r.saldo_anterior_min,
        extrasMin: r.extras_semana_min,
        ajustesMin: r.ajustes_min,
        acumuladoMin: r.acumulado_min,
        fechouCorte: r.fechou_corte,
        segueMin: r.proxima_semana_min,
      }));
    const ultima = semanas.at(-1);
    const ajustesPendentesMin = (rAju.data ?? [])
      .filter((a) => a.funcionaria_id === f.id && (!ultima || a.segunda > ultima.segunda))
      .reduce((t, a) => t + a.minutos, 0);
    return {
      id: f.id,
      nomeExibicao: f.nome_exibicao,
      saldoAtualMin: (ultima?.segueMin ?? 0) + ajustesPendentesMin,
      ajustesPendentesMin,
      fechadoAte: ultima?.segunda ?? null,
      semanas,
      ajustes: (rAju.data ?? [])
        .filter((a) => a.funcionaria_id === f.id)
        .map((a) => ({ segunda: a.segunda, minutos: a.minutos, motivo: a.motivo, criadoEm: a.criado_em })),
    };
  });
}

export async function carregarSemana(supabase: ClienteSupabase, segunda: string, opcoes: { funcionariaId?: string } = {}): Promise<SemanaCarregada> {
  const domingo = somarDias(segunda, 6);

  let qFuncionarias = supabase.from("funcionarias").select("id, nome, nome_exibicao, en_no, ativa, carga_seg_qui_min, carga_sex_min").order("nome_exibicao");
  if (opcoes.funcionariaId) qFuncionarias = qFuncionarias.eq("id", opcoes.funcionariaId);

  const [regras, rFer, rFun, rBat, rLan, rSem, rAju, rRes, rPerfis, rIgn] = await Promise.all([
    regrasVigentes(supabase, segunda),
    supabase.from("feriados").select("data, nome").gte("data", segunda).lte("data", domingo),
    qFuncionarias,
    supabase.from("batidas").select("id, en_no, funcionaria_id, data, hora_seg, iomd").gte("data", segunda).lte("data", domingo),
    supabase.from("ponto_lancamentos").select("*").gte("data", segunda).lte("data", domingo),
    supabase.from("semanas").select("segunda, status, fechada_em").eq("segunda", segunda).maybeSingle(),
    supabase.from("ajustes_saldo").select("funcionaria_id, minutos").eq("segunda", segunda),
    // Último fechamento anterior a esta semana, por funcionária.
    supabase.from("semana_resultados").select("segunda, funcionaria_id, proxima_semana_min").lt("segunda", segunda).order("segunda", { ascending: false }),
    supabase.from("perfis").select("id, nome"),
    opcoes.funcionariaId ? Promise.resolve({ data: [] as { en_no: string }[] }) : supabase.from("catraca_ids_ignorados").select("en_no"),
  ]);

  for (const r of [rFer, rFun, rBat, rLan, rSem, rAju, rRes]) {
    if (r.error) throw new Error(`Falha ao carregar a semana: ${r.error.message}`);
  }

  const feriados = Object.fromEntries((rFer.data ?? []).map((f) => [f.data, f.nome]));
  const nomes = new Map((rPerfis.data ?? []).map((p) => [p.id, p.nome]));
  const lancamentos = (rLan.data ?? []).map((l) => ({ funcionariaId: l.funcionaria_id, l: lancamentoDaLinha(l, nomes) }));
  const batidas = rBat.data ?? [];

  const ultimoResultado = new Map<string, { segunda: string; proxima: number }>();
  for (const r of rRes.data ?? []) {
    if (!ultimoResultado.has(r.funcionaria_id)) ultimoResultado.set(r.funcionaria_id, { segunda: r.segunda, proxima: r.proxima_semana_min });
  }

  // Inativa continua na semana em que trabalhou (senão sumiria do fechamento ao ser desligada no meio dela).
  const comMovimento = new Set([...batidas.map((b) => b.funcionaria_id), ...lancamentos.map((x) => x.funcionariaId)]);
  const funcionarias: FuncionariaSemana[] = (rFun.data ?? []).filter((f) => f.ativa || opcoes.funcionariaId || comMovimento.has(f.id)).map((f) => {
    const ultimo = ultimoResultado.get(f.id);
    const dela = lancamentos.filter((x) => x.funcionariaId === f.id).map((x) => x.l);
    const resultado = avaliarSemana({
      segunda,
      regras,
      jornada: { cargaSegQuiMin: f.carga_seg_qui_min, cargaSexMin: f.carga_sex_min },
      feriados,
      batidas: batidas.filter((b) => b.funcionaria_id === f.id).map((b) => ({ id: b.id, data: b.data, horaSeg: b.hora_seg, iomd: b.iomd })),
      lancamentos: dela,
      saldoAnteriorMin: ultimo?.proxima ?? 0,
      ajustesMin: (rAju.data ?? []).filter((a) => a.funcionaria_id === f.id).reduce((s, a) => s + a.minutos, 0),
    });
    return {
      id: f.id,
      nome: f.nome,
      nomeExibicao: f.nome_exibicao,
      enNo: f.en_no,
      resultado,
      lancamentos: dela,
      saldoProvisorio: !!ultimo && ultimo.segunda !== somarDias(segunda, -7),
    };
  });

  const ignorados = new Set((rIgn.data ?? []).map((i) => i.en_no));
  const desconhecidas = new Map<string, IdDesconhecido>();
  for (const b of batidas) {
    if (b.funcionaria_id || ignorados.has(b.en_no)) continue;
    const d = desconhecidas.get(b.en_no) ?? { enNo: b.en_no, batidas: 0, dias: [] };
    d.batidas++;
    if (!d.dias.includes(b.data)) d.dias.push(b.data);
    desconhecidas.set(b.en_no, d);
  }

  return {
    segunda,
    status: rSem.data?.status ?? "aberta",
    fechadaEm: rSem.data?.fechada_em ?? null,
    regras,
    feriados,
    funcionarias,
    idsDesconhecidos: [...desconhecidas.values()],
    temBatidas: batidas.length > 0,
  };
}
