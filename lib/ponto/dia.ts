/**
 * Avaliação de um dia de uma funcionária.
 *
 * Duas camadas, de propósito separadas:
 *   1. A CONTA das horas é a do script legado (pontos/calculos.py), posicional sobre as
 *      batidas válidas. Dia sem problema dá sempre o mesmo número que o sistema antigo.
 *   2. A VALIDAÇÃO classifica cada batida pelo horário (o código de tipo da catraca não é
 *      confiável), aponta o que falta e sugere a correção. Ela nunca muda a conta sozinha:
 *      só um lançamento da gestora muda o dia.
 *
 * O dia é o resultado de aplicar o diário de lançamentos (append-only) sobre as batidas brutas.
 */

import { cargaDoDiaUtil, type Jornada, type Regras } from "./regras";
import { duracao, horaDeSeg, isoDow, NOME_DIA } from "./tempo";

export type TipoBatida = "E" | "A" | "V" | "S";
export type Ocorrencia = "atestado" | "falta_justificada" | "folga" | "feriado" | "falta";

export const NOME_TIPO: Record<TipoBatida, string> = {
  E: "Entrada",
  A: "Saída para almoço",
  V: "Volta do almoço",
  S: "Saída",
};

export const NOME_OCORRENCIA: Record<Ocorrencia, string> = {
  atestado: "Atestado",
  falta_justificada: "Falta justificada",
  folga: "Folga",
  feriado: "Feriado",
  falta: "Falta",
};

const TIPO_DO_IOMD: Record<number, TipoBatida> = { 0: "E", 1: "A", 2: "V", 3: "S" };
const POSICIONAL: readonly TipoBatida[] = ["E", "A", "V", "S"];

export interface BatidaCatraca {
  id: number;
  horaSeg: number;
  iomd: number | null;
}

export type AlvoBatida = { batidaId: number } | { lancamentoId: number };

interface LancamentoBase {
  id: number;
  motivo: string;
  criadoEm: string;
  autorNome?: string | null;
  solicitacaoId?: number | null;
}

export type Lancamento = LancamentoBase &
  (
    | { tipo: "adicionar_batida"; horaSeg: number; tipoBatida: TipoBatida }
    | { tipo: "alterar_horario"; alvo: AlvoBatida; horaSeg: number }
    | { tipo: "desconsiderar_batida"; alvo: AlvoBatida }
    | { tipo: "trocar_tipo"; alvo: AlvoBatida; tipoBatida: TipoBatida }
    | { tipo: "ocorrencia"; ocorrencia: Ocorrencia }
    | { tipo: "resolver_pendencia"; codigo: CodigoPendencia; assinatura: string }
    | { tipo: "cancelar"; lancamentoAlvoId: number }
  );

export type CodigoPendencia =
  // bloqueiam o fechamento
  | "FALTA_VOLTA_ALMOCO"
  | "FALTA_SAIDA_ALMOCO"
  | "FALTA_SAIDA"
  | "FALTA_ALMOCO"
  | "SAIU_NO_ALMOCO"
  | "BATIDA_UNICA"
  | "MAIS_DE_4_BATIDAS"
  | "CLASSIFICACAO_INCERTA"
  // avisos
  | "ALMOCO_CURTO"
  | "EXTRA_ACIMA_2H"
  | "ATRASO"
  | "SAIDA_ANTECIPADA"
  | "INTERJORNADA_CURTA"
  | "DUPLICADAS_UNIFICADAS"
  | "BATIDA_FIM_DE_SEMANA"
  | "BATIDA_EM_FERIADO";

export type Severidade = "bloqueia" | "aviso";

export type AcaoSugerida =
  | { tipo: "adicionar_batida"; horaSeg: number; tipoBatida: TipoBatida }
  | { tipo: "trocar_tipo"; ref: string; tipoBatida: TipoBatida }
  | { tipo: "desconsiderar_batida"; ref: string }
  | { tipo: "confirmar" };

export interface Pendencia {
  codigo: CodigoPendencia;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  /** Sem ações = não há correção de um clique; a gestora ajusta no detalhe do dia. */
  sugestao: { texto: string; acoes: AcaoSugerida[] };
  resolucao?: { lancamentoId: number; motivo: string; criadoEm: string; autorNome?: string | null };
}

export interface BatidaDia {
  /** "c<id>" = batida da catraca; "m<id>" = adicionada (id do lançamento que a criou). */
  ref: string;
  horaSeg: number;
  hora: string;
  origem: "catraca" | "manual";
  /** Tipo usado no dia; null = fora do cálculo (desconsiderada, duplicada ou excedente). */
  tipo: TipoBatida | null;
  tipoCatraca: TipoBatida | null;
  /** A catraca marcou outro tipo e o sistema corrigiu pelo horário (não vira pendência). */
  tipoCorrigido: boolean;
  horaOriginal: string | null;
  ajustada: boolean;
  desconsiderada: boolean;
  motivoDesconsiderada: string | null;
  duplicadaDe: string | null;
  excedente: boolean;
}

export type Situacao =
  | "ok"
  | "pendencia"
  | "aviso"
  | "ajustado"
  | "falta"
  | "atestado"
  | "falta_justificada"
  | "folga"
  | "feriado"
  | "sem_jornada";

export interface ResultadoDia {
  data: string;
  dow: number;
  cargaMin: number;
  feriado: string | null;
  /** Fim de semana ou feriado com batida: aparece, mas não entra no banco (regra da empresa). */
  foraDoCalculo: boolean;
  batidas: BatidaDia[];
  /** null = "Falta" (nenhuma ou uma batida), como no legado. */
  trabalhadasMin: number | null;
  extraMin: number;
  situacao: Situacao;
  pendencias: Pendencia[];
  resolvidas: Pendencia[];
  ocorrencia: { tipo: Ocorrencia; motivo: string; lancamentoId: number } | null;
  ajustado: boolean;
  /** Estado das batidas; resolução de pendência só vale enquanto a assinatura não mudar. */
  assinatura: string;
  calculo: string;
  previsto: { entradaMin: number; saidaMin: number } | null;
  /** Entra na soma do banco agora: dia útil, dentro do cálculo e sem pendência que bloqueia. */
  contaNoBanco: boolean;
}

export interface EntradaDia {
  data: string;
  regras: Regras;
  jornada?: Jornada;
  feriado?: string | null;
  batidas: BatidaCatraca[];
  lancamentos: Lancamento[];
  /** Hora da saída do dia anterior, para o aviso de descanso menor que 11h. */
  saidaDiaAnteriorSeg?: number | null;
}

// ---------------------------------------------------------------------------
// Conta do legado
// ---------------------------------------------------------------------------

/** Intervalo em minutos inteiros, truncando segundos — igual a calc_interval do legado. */
function intervalo(a: number, b: number): number {
  return Math.floor((b - a) / 60);
}

export interface ContaLegado {
  trabalhadasMin: number | null;
  manhaMin?: number;
  tardeMin?: number;
  almocoMin?: number;
  descontoAlmocoMin?: number;
}

/**
 * Port literal de calcular_dia (pontos/calculos.py) sobre horários já ordenados.
 * 4+ batidas: manhã + tarde − (almoço curto vira desconto: conta como almoço padrão).
 * 2 ou 3 batidas: só o primeiro período. 0 ou 1: "Falta".
 */
export function contaLegado(horasSeg: number[], almocoPadraoMin: number): ContaLegado {
  const h = horasSeg.slice(0, 4);
  if (h.length <= 1) return { trabalhadasMin: null };
  if (h.length < 4) return { trabalhadasMin: intervalo(h[0]!, h[1]!) };
  const manhaMin = intervalo(h[0]!, h[1]!);
  const tardeMin = intervalo(h[2]!, h[3]!);
  const almocoMin = intervalo(h[1]!, h[2]!);
  const descontoAlmocoMin = almocoMin < almocoPadraoMin ? almocoPadraoMin - almocoMin : 0;
  return {
    trabalhadasMin: Math.max(0, manhaMin + tardeMin - descontoAlmocoMin),
    manhaMin,
    tardeMin,
    almocoMin,
    descontoAlmocoMin,
  };
}

// ---------------------------------------------------------------------------
// Aplicação do diário
// ---------------------------------------------------------------------------

interface Efetiva {
  ref: string;
  horaSeg: number;
  horaOriginalSeg: number | null;
  origem: "catraca" | "manual";
  iomd: number | null;
  tipoForcado: TipoBatida | null;
  ajustada: boolean;
  desconsiderada: boolean;
  motivoDesconsiderada: string | null;
  duplicadaDe: string | null;
}

/** Lançamentos em vigor: tira os cancelados (um cancelamento cancelado volta a valer). */
export function lancamentosEmVigor(lancamentos: Lancamento[]): Lancamento[] {
  const ordenados = [...lancamentos].sort((a, b) => a.id - b.id);
  const cancelados = new Set<number>();
  // Cancelamento sempre aponta para um id menor: varrer de trás para frente resolve a cadeia.
  for (let i = ordenados.length - 1; i >= 0; i--) {
    const l = ordenados[i]!;
    if (l.tipo === "cancelar" && !cancelados.has(l.id)) cancelados.add(l.lancamentoAlvoId);
  }
  return ordenados.filter((l) => l.tipo !== "cancelar" && !cancelados.has(l.id));
}

const refDoAlvo = (a: AlvoBatida) => ("batidaId" in a ? `c${a.batidaId}` : `m${a.lancamentoId}`);

function aplicarDiario(batidas: BatidaCatraca[], vigentes: Lancamento[]) {
  const porRef = new Map<string, Efetiva>();
  for (const b of batidas) {
    porRef.set(`c${b.id}`, {
      ref: `c${b.id}`,
      horaSeg: b.horaSeg,
      horaOriginalSeg: null,
      origem: "catraca",
      iomd: b.iomd,
      tipoForcado: null,
      ajustada: false,
      desconsiderada: false,
      motivoDesconsiderada: null,
      duplicadaDe: null,
    });
  }

  let ocorrencia: ResultadoDia["ocorrencia"] = null;
  const resolucoes: Extract<Lancamento, { tipo: "resolver_pendencia" }>[] = [];
  let mexeuEmBatida = false;

  for (const l of vigentes) {
    switch (l.tipo) {
      case "adicionar_batida":
        porRef.set(`m${l.id}`, {
          ref: `m${l.id}`,
          horaSeg: l.horaSeg,
          horaOriginalSeg: null,
          origem: "manual",
          iomd: null,
          tipoForcado: l.tipoBatida,
          ajustada: false,
          desconsiderada: false,
          motivoDesconsiderada: null,
          duplicadaDe: null,
        });
        mexeuEmBatida = true;
        break;
      case "alterar_horario": {
        const p = porRef.get(refDoAlvo(l.alvo));
        if (!p) break;
        p.horaOriginalSeg ??= p.horaSeg;
        p.horaSeg = l.horaSeg;
        p.ajustada = true;
        mexeuEmBatida = true;
        break;
      }
      case "desconsiderar_batida": {
        const p = porRef.get(refDoAlvo(l.alvo));
        if (!p) break;
        p.desconsiderada = true;
        p.motivoDesconsiderada = l.motivo;
        mexeuEmBatida = true;
        break;
      }
      case "trocar_tipo": {
        const p = porRef.get(refDoAlvo(l.alvo));
        if (!p) break;
        p.tipoForcado = l.tipoBatida;
        p.ajustada = true;
        mexeuEmBatida = true;
        break;
      }
      case "ocorrencia":
        ocorrencia = { tipo: l.ocorrencia, motivo: l.motivo, lancamentoId: l.id };
        break;
      case "resolver_pendencia":
        resolucoes.push(l);
        break;
    }
  }

  const todas = [...porRef.values()].sort(
    (a, b) => a.horaSeg - b.horaSeg || (a.origem === b.origem ? a.ref.localeCompare(b.ref) : a.origem === "catraca" ? -1 : 1),
  );
  return { todas, ocorrencia, resolucoes, mexeuEmBatida };
}

/**
 * Batidas da catraca a poucos minutos da anterior viram uma só (fica a primeira).
 * Batida com tipo escolhido pela gestora nunca é unificada: a decisão dela vale mais que a heurística.
 */
function unificarDuplicadas(ativas: Efetiva[], janelaMin: number): Efetiva[] {
  const validas: Efetiva[] = [];
  for (const p of ativas) {
    const anterior = validas[validas.length - 1];
    if (
      anterior &&
      p.origem === "catraca" &&
      anterior.origem === "catraca" &&
      !p.tipoForcado &&
      !anterior.tipoForcado &&
      p.horaSeg - anterior.horaSeg <= janelaMin * 60
    ) {
      p.duplicadaDe = anterior.ref;
      continue;
    }
    validas.push(p);
  }
  return validas;
}

// ---------------------------------------------------------------------------
// Classificação pelo horário
// ---------------------------------------------------------------------------

interface Previsao {
  entradaMin: number;
  almocoMin: number;
  voltaMin: number;
  saidaMin: number;
  /** Entre a volta e a saída previstas: acima disso, a última batida é a saída. */
  limiarSaidaMin: number;
}

function classificar(validas: Efetiva[], prev: Previsao): (TipoBatida | null)[] {
  const n = validas.length;
  const m = validas.map((p) => p.horaSeg / 60);
  let tipos: (TipoBatida | null)[];
  if (n === 0) tipos = [];
  else if (n === 1) tipos = [m[0]! < prev.limiarSaidaMin ? "E" : "S"];
  else if (n === 2) {
    // Segunda batida na janela do almoço = foi almoçar e não voltou; fora dela = saída do dia.
    const noAlmoco = m[1]! >= prev.almocoMin - 30 && m[1]! < prev.voltaMin;
    tipos = ["E", noAlmoco ? "A" : "S"];
  }
  else if (n === 3) {
    if (m[2]! >= prev.limiarSaidaMin) {
      // Entrada … saída: a do meio é a ida ou a volta do almoço, a que estiver mais perto do previsto.
      const meio = Math.abs(m[1]! - prev.almocoMin) <= Math.abs(m[1]! - prev.voltaMin) ? "A" : "V";
      tipos = ["E", meio, "S"];
    } else {
      tipos = ["E", "A", "V"];
    }
  } else {
    tipos = validas.map((_, i) => (i < 4 ? POSICIONAL[i]! : null));
  }
  // Tipo escolhido pela gestora prevalece (as excedentes continuam fora).
  validas.forEach((p, i) => {
    if (p.tipoForcado && tipos[i] !== null) tipos[i] = p.tipoForcado;
  });
  return tipos;
}

// ---------------------------------------------------------------------------
// Pendências
// ---------------------------------------------------------------------------

const confirmar = (texto: string) => ({ texto, acoes: [{ tipo: "confirmar" } as const] });
const semAcao = { texto: "Ajuste as batidas no detalhe do dia ou lance uma ocorrência.", acoes: [] };
const lista = (hs: string[]) =>
  hs.length <= 1 ? (hs[0] ?? "") : `${hs.slice(0, -1).join(", ")} e ${hs[hs.length - 1]}`;

function pendenciasEstruturais(validas: Efetiva[], tipos: (TipoBatida | null)[], prev: Previsao, regras: Regras): Pendencia[] {
  const out: Pendencia[] = [];
  const n = validas.length;
  const horas = validas.map((p) => horaDeSeg(p.horaSeg));
  const batidasTxt = `Bateu às ${lista(horas)}.`;
  const padrao = duracao(regras.almocoPadraoMin);

  if (n === 1) {
    out.push({
      codigo: "BATIDA_UNICA",
      severidade: "bloqueia",
      titulo: "Só uma batida no dia",
      descricao: `Há apenas a batida das ${horas[0]}. Informe as que faltam ou lance uma ocorrência.`,
      sugestao: semAcao,
    });
    return out;
  }

  if (n > 4) {
    const excedentes = validas.slice(4);
    out.push({
      codigo: "MAIS_DE_4_BATIDAS",
      severidade: "bloqueia",
      titulo: "Mais de 4 batidas no dia",
      descricao: `${batidasTxt} O cálculo usa só as 4 primeiras, como hoje.`,
      sugestao: {
        texto: `Desconsiderar ${lista(excedentes.map((p) => horaDeSeg(p.horaSeg)))}`,
        acoes: excedentes.map((p) => ({ tipo: "desconsiderar_batida" as const, ref: p.ref })),
      },
    });
  }

  const v = validas.slice(0, 4);
  const seq = tipos.slice(0, 4).join("");

  if (seq === "EAVS") return out;

  if (seq === "ES") {
    const corridoMin = intervalo(v[0]!.horaSeg, v[1]!.horaSeg);
    if (corridoMin > 6 * 60) {
      const a = prev.almocoMin * 60;
      const vo = prev.voltaMin * 60;
      const cabe = v[0]!.horaSeg < a && vo < v[1]!.horaSeg;
      out.push({
        codigo: "FALTA_ALMOCO",
        severidade: "bloqueia",
        titulo: "Faltaram as batidas do almoço",
        descricao: `${batidasTxt} Sem registro de almoço, o dia conta ${duracao(corridoMin)} corridas.`,
        sugestao: cabe
          ? {
              texto: `Registrar o almoço padrão: ${horaDeSeg(a)} às ${horaDeSeg(vo)}`,
              acoes: [
                { tipo: "adicionar_batida", horaSeg: a, tipoBatida: "A" },
                { tipo: "adicionar_batida", horaSeg: vo, tipoBatida: "V" },
              ],
            }
          : semAcao,
      });
    }
    return out;
  }

  if (seq === "EA") {
    out.push({
      codigo: "SAIU_NO_ALMOCO",
      severidade: "bloqueia",
      titulo: "Saiu para o almoço e não voltou",
      descricao: `${batidasTxt} Não há volta do almoço nem saída.`,
      sugestao: {
        texto: `Considerar meio período: ${horas[1]} vira a saída do dia`,
        acoes: [{ tipo: "trocar_tipo", ref: v[1]!.ref, tipoBatida: "S" }],
      },
    });
    return out;
  }

  if (seq === "EAS") {
    const volta = v[1]!.horaSeg + regras.almocoPadraoMin * 60;
    out.push({
      codigo: "FALTA_VOLTA_ALMOCO",
      severidade: "bloqueia",
      titulo: "Faltou a volta do almoço",
      descricao: `${batidasTxt} Pelo horário, ${horas[2]} é a saída — falta a volta do almoço.`,
      sugestao:
        volta < v[2]!.horaSeg
          ? {
              texto: `Aplicar o almoço padrão de ${padrao}: volta às ${horaDeSeg(volta)}`,
              acoes: [{ tipo: "adicionar_batida", horaSeg: volta, tipoBatida: "V" }],
            }
          : semAcao,
    });
    return out;
  }

  if (seq === "EVS") {
    const ida = v[1]!.horaSeg - regras.almocoPadraoMin * 60;
    out.push({
      codigo: "FALTA_SAIDA_ALMOCO",
      severidade: "bloqueia",
      titulo: "Faltou a saída para o almoço",
      descricao: `${batidasTxt} Pelo horário, ${horas[1]} é a volta do almoço — falta a saída.`,
      sugestao:
        ida > v[0]!.horaSeg
          ? {
              texto: `Aplicar o almoço padrão de ${padrao}: saída às ${horaDeSeg(ida)}`,
              acoes: [{ tipo: "adicionar_batida", horaSeg: ida, tipoBatida: "A" }],
            }
          : semAcao,
    });
    return out;
  }

  if (seq === "EAV") {
    const saida = prev.saidaMin * 60;
    out.push({
      codigo: "FALTA_SAIDA",
      severidade: "bloqueia",
      titulo: "Faltou a saída",
      descricao: `${batidasTxt} Não há registro de saída.`,
      sugestao:
        saida > v[2]!.horaSeg
          ? {
              texto: `Registrar a saída às ${horaDeSeg(saida)} (fim da jornada prevista)`,
              acoes: [{ tipo: "adicionar_batida", horaSeg: saida, tipoBatida: "S" }],
            }
          : semAcao,
    });
    return out;
  }

  out.push({
    codigo: "CLASSIFICACAO_INCERTA",
    severidade: "bloqueia",
    titulo: "Batidas que não dá para classificar",
    descricao: `${batidasTxt} A sequência ficou ${tipos
      .slice(0, 4)
      .map((t) => (t ? NOME_TIPO[t].toLowerCase() : "?"))
      .join(", ")}. Revise os tipos.`,
    sugestao: semAcao,
  });
  return out;
}

function avisos(
  validas: Efetiva[],
  tipos: (TipoBatida | null)[],
  prev: Previsao,
  regras: Regras,
  cargaMin: number,
  extraMin: number,
  saidaDiaAnteriorSeg: number | null | undefined,
): Pendencia[] {
  const out: Pendencia[] = [];
  const v = validas.slice(0, 4);
  const t = tipos.slice(0, 4);

  if (t[0] === "E") {
    const entradaMin = Math.floor(v[0]!.horaSeg / 60);
    const atraso = entradaMin - prev.entradaMin;
    if (atraso > regras.toleranciaAtrasoMin) {
      out.push({
        codigo: "ATRASO",
        severidade: "aviso",
        titulo: "Atraso além da tolerância",
        descricao: `Entrada às ${horaDeSeg(v[0]!.horaSeg)} — ${duracao(atraso)} depois do previsto (tolerância de ${regras.toleranciaAtrasoMin} min).`,
        sugestao: confirmar("Confirmar o atraso"),
      });
    }
    if (saidaDiaAnteriorSeg != null) {
      const descansoMin = Math.floor((86_400 - saidaDiaAnteriorSeg + v[0]!.horaSeg) / 60);
      if (descansoMin < 11 * 60) {
        out.push({
          codigo: "INTERJORNADA_CURTA",
          severidade: "aviso",
          titulo: "Descanso menor que 11h entre dois dias",
          descricao: `Saiu às ${horaDeSeg(saidaDiaAnteriorSeg)} do dia anterior e entrou às ${horaDeSeg(v[0]!.horaSeg)} — ${duracao(descansoMin)} de descanso.`,
          sugestao: confirmar("Confirmar o descanso curto"),
        });
      }
    }
  }

  const iS = t.lastIndexOf("S");
  if (iS >= 0 && cargaMin > 0) {
    const saidaMin = Math.floor(v[iS]!.horaSeg / 60);
    const antes = prev.saidaMin - saidaMin;
    if (antes > regras.toleranciaAtrasoMin) {
      out.push({
        codigo: "SAIDA_ANTECIPADA",
        severidade: "aviso",
        titulo: "Saída antes do previsto",
        descricao: `Saída às ${horaDeSeg(v[iS]!.horaSeg)} — ${duracao(antes)} antes do previsto (${horaDeSeg(prev.saidaMin * 60)}).`,
        sugestao: confirmar("Confirmar a saída antecipada"),
      });
    }
  }

  const iA = t.indexOf("A");
  if (iA >= 0 && t[iA + 1] === "V") {
    const almoco = intervalo(v[iA]!.horaSeg, v[iA + 1]!.horaSeg);
    // Com tolerância: almoço de 58–59 min é rotina nos dados reais e a regra já não dá crédito por ele.
    if (almoco < regras.almocoPadraoMin - regras.toleranciaAtrasoMin) {
      out.push({
        codigo: "ALMOCO_CURTO",
        severidade: "aviso",
        titulo: `Almoço menor que ${duracao(regras.almocoPadraoMin)}`,
        descricao: `Almoço de ${duracao(almoco)} (${horaDeSeg(v[iA]!.horaSeg)} às ${horaDeSeg(v[iA + 1]!.horaSeg)}). Pela regra da empresa, conta como ${duracao(regras.almocoPadraoMin)}.`,
        sugestao: confirmar("Confirmar o almoço curto"),
      });
    }
  }

  if (extraMin > 120) {
    out.push({
      codigo: "EXTRA_ACIMA_2H",
      severidade: "aviso",
      titulo: "Mais de 2h extras no dia",
      descricao: `${duracao(extraMin)} além da carga de ${duracao(cargaMin)}.`,
      sugestao: confirmar("Confirmar as horas extras"),
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------------

function textoCalculo(conta: ContaLegado, n: number, cargaMin: number, extraMin: number, provisorio: boolean): string {
  const carga = `carga ${duracao(cargaMin)}`;
  if (conta.trabalhadasMin === null) return n === 0 ? `Sem batidas · ${carga} · falta` : `Batidas insuficientes · ${carga} · conta como falta`;
  let base: string;
  if (conta.manhaMin !== undefined) {
    base = `Manhã ${duracao(conta.manhaMin)} + tarde ${duracao(conta.tardeMin!)}`;
    if (conta.descontoAlmocoMin) {
      base += ` − ${duracao(conta.descontoAlmocoMin)} (almoço de ${duracao(conta.almocoMin!)} conta como ${duracao(conta.almocoMin! + conta.descontoAlmocoMin)})`;
    }
    base += ` = ${duracao(conta.trabalhadasMin)}`;
  } else {
    base = `Primeiro período ${duracao(conta.trabalhadasMin)}`;
  }
  return `${provisorio ? "Provisório: " : ""}${base} · ${carga} · extra ${duracao(extraMin)}`;
}

function assinar(ativas: Efetiva[]): string {
  return ativas.map((p) => `${p.horaSeg}${p.tipoForcado ?? ""}`).join(",") || "vazio";
}

export function avaliarDia(e: EntradaDia): ResultadoDia {
  const { regras } = e;
  const dow = isoDow(e.data);
  const feriado = e.feriado ?? null;
  const fimDeSemana = dow >= 6;
  const cargaUtil = cargaDoDiaUtil(regras, dow, e.jornada);
  const cargaMin = fimDeSemana || feriado ? 0 : cargaUtil;

  // Referência de horário para classificar (no fim de semana, usa a jornada de seg–qui).
  const cargaRef = cargaUtil || cargaDoDiaUtil(regras, 1, e.jornada);
  const prev: Previsao = {
    entradaMin: regras.entradaPrevistaMin,
    almocoMin: regras.almocoInicioPrevistoMin,
    voltaMin: regras.almocoInicioPrevistoMin + regras.almocoPadraoMin,
    saidaMin: regras.entradaPrevistaMin + cargaRef + regras.almocoPadraoMin,
    limiarSaidaMin: 0,
  };
  prev.limiarSaidaMin = (prev.voltaMin + prev.saidaMin) / 2;

  const vigentes = lancamentosEmVigor(e.lancamentos);
  const { todas, ocorrencia, resolucoes, mexeuEmBatida } = aplicarDiario(e.batidas, vigentes);
  const ativas = todas.filter((p) => !p.desconsiderada);
  const validas = unificarDuplicadas(ativas, regras.janelaDuplicadaMin);
  const tipos = classificar(validas, prev);
  const n = validas.length;
  const assinatura = assinar(ativas);

  const conta = contaLegado(
    validas.map((p) => p.horaSeg),
    regras.almocoPadraoMin,
  );
  const foraDoCalculo = (fimDeSemana || !!feriado) && n > 0 && !ocorrencia;

  let trabalhadasMin: number | null = conta.trabalhadasMin;
  let extraMin = 0;
  if (ocorrencia) {
    const abonada = ocorrencia.tipo === "atestado" || ocorrencia.tipo === "falta_justificada";
    trabalhadasMin = abonada ? cargaMin : 0;
  } else if (!foraDoCalculo) {
    extraMin = Math.max(0, (conta.trabalhadasMin ?? 0) - cargaMin);
  }

  // Pendências calculadas (antes de olhar as resoluções).
  let calculadas: Pendencia[] = [];
  if (!ocorrencia && n > 0) {
    if (foraDoCalculo) {
      const periodo = `das ${horaDeSeg(validas[0]!.horaSeg)} às ${horaDeSeg(validas[n - 1]!.horaSeg)}`;
      calculadas.push(
        feriado
          ? {
              codigo: "BATIDA_EM_FERIADO",
              severidade: "aviso",
              titulo: "Batida em feriado",
              descricao: `${feriado}, ${periodo}. Fica fora do banco de horas.`,
              sugestao: confirmar("Confirmar"),
            }
          : {
              codigo: "BATIDA_FIM_DE_SEMANA",
              severidade: "aviso",
              titulo: "Batida em fim de semana",
              descricao: `${NOME_DIA[dow]}, ${periodo}. Pela regra da empresa, fica fora do banco de horas.`,
              sugestao: confirmar("Confirmar"),
            },
      );
    } else {
      calculadas = [
        ...pendenciasEstruturais(validas, tipos, prev, regras),
        ...avisos(validas, tipos, prev, regras, cargaMin, extraMin, e.saidaDiaAnteriorSeg),
      ];
      const duplicadas = ativas.filter((p) => p.duplicadaDe);
      if (duplicadas.length) {
        const pares = duplicadas.map((d) => {
          const original = ativas.find((p) => p.ref === d.duplicadaDe)!;
          return `${horaDeSeg(original.horaSeg)} e ${horaDeSeg(d.horaSeg)}`;
        });
        calculadas.push({
          codigo: "DUPLICADAS_UNIFICADAS",
          severidade: "aviso",
          titulo: "Batidas duplicadas unificadas",
          descricao: `${lista(pares)}, com menos de ${regras.janelaDuplicadaMin} min de diferença. O sistema manteve a primeira.`,
          sugestao: confirmar("Confirmar a unificação"),
        });
      }
    }
  }

  const pendencias: Pendencia[] = [];
  const resolvidas: Pendencia[] = [];
  for (const p of calculadas) {
    const r = [...resolucoes].reverse().find((x) => x.codigo === p.codigo && x.assinatura === assinatura);
    if (r) resolvidas.push({ ...p, resolucao: { lancamentoId: r.id, motivo: r.motivo, criadoEm: r.criadoEm, autorNome: r.autorNome } });
    else pendencias.push(p);
  }

  const bloqueia = pendencias.some((p) => p.severidade === "bloqueia");
  const ajustado = mexeuEmBatida || resolvidas.some((p) => p.severidade === "bloqueia");

  let situacao: Situacao;
  if (ocorrencia) situacao = ocorrencia.tipo;
  else if (fimDeSemana || feriado) situacao = n === 0 ? (feriado ? "feriado" : "sem_jornada") : pendencias.length ? "aviso" : "ok";
  else if (n === 0) situacao = "falta";
  else if (bloqueia) situacao = "pendencia";
  else if (pendencias.length) situacao = "aviso";
  else if (conta.trabalhadasMin === null) situacao = "falta";
  else situacao = ajustado ? "ajustado" : "ok";

  let calculo: string;
  if (ocorrencia) {
    const nome = NOME_OCORRENCIA[ocorrencia.tipo];
    calculo =
      ocorrencia.tipo === "atestado" || ocorrencia.tipo === "falta_justificada"
        ? `${nome} · carga ${duracao(cargaMin)} abonada · extra 0h00`
        : `${nome} · ${duracao(0)} trabalhadas · não mexe no banco`;
  } else if (foraDoCalculo) {
    calculo = `${feriado ?? NOME_DIA[dow]} · ${duracao(conta.trabalhadasMin ?? 0)} registradas, fora do banco de horas`;
  } else if (n === 0 && (fimDeSemana || feriado)) {
    calculo = feriado ? `Feriado · ${feriado}` : "Sem jornada prevista";
  } else {
    calculo = textoCalculo(conta, n, cargaMin, extraMin, bloqueia);
  }

  const batidas: BatidaDia[] = todas.map((p) => {
    const i = validas.indexOf(p);
    const tipo = i >= 0 ? (tipos[i] ?? null) : null;
    const tipoCatraca = p.iomd != null ? (TIPO_DO_IOMD[p.iomd] ?? null) : null;
    return {
      ref: p.ref,
      horaSeg: p.horaSeg,
      hora: horaDeSeg(p.horaSeg),
      origem: p.origem,
      tipo,
      tipoCatraca,
      tipoCorrigido: p.origem === "catraca" && !p.tipoForcado && tipo !== null && tipoCatraca !== null && tipoCatraca !== tipo,
      horaOriginal: p.horaOriginalSeg != null ? horaDeSeg(p.horaOriginalSeg) : null,
      ajustada: p.ajustada,
      desconsiderada: p.desconsiderada,
      motivoDesconsiderada: p.motivoDesconsiderada,
      duplicadaDe: p.duplicadaDe,
      excedente: i >= 4,
    };
  });

  return {
    data: e.data,
    dow,
    cargaMin,
    feriado,
    foraDoCalculo,
    batidas,
    trabalhadasMin,
    extraMin,
    situacao,
    pendencias,
    resolvidas,
    ocorrencia,
    ajustado,
    assinatura,
    calculo,
    previsto: cargaMin > 0 ? { entradaMin: prev.entradaMin, saidaMin: prev.saidaMin } : null,
    contaNoBanco: dow <= 5 && !foraDoCalculo && !bloqueia,
  };
}
