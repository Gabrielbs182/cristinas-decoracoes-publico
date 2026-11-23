/** Texto do histórico do dia: quem alterou, quando, de quê para quê. O diário é a fonte. */
import { type CodigoPendencia, type Lancamento, lancamentosEmVigor, NOME_OCORRENCIA, NOME_TIPO, type ResultadoDia } from "./dia";
import { horaDeSeg } from "./tempo";

export const NOME_PENDENCIA: Record<CodigoPendencia, string> = {
  FALTA_VOLTA_ALMOCO: "faltou a volta do almoço",
  FALTA_SAIDA_ALMOCO: "faltou a saída para o almoço",
  FALTA_SAIDA: "faltou a saída",
  FALTA_ALMOCO: "faltaram as batidas do almoço",
  SAIU_NO_ALMOCO: "saiu para o almoço e não voltou",
  BATIDA_UNICA: "só uma batida no dia",
  MAIS_DE_4_BATIDAS: "mais de 4 batidas",
  CLASSIFICACAO_INCERTA: "batidas sem classificação",
  ALMOCO_CURTO: "almoço curto",
  EXTRA_ACIMA_2H: "mais de 2h extras",
  ATRASO: "atraso",
  SAIDA_ANTECIPADA: "saída antecipada",
  INTERJORNADA_CURTA: "descanso curto",
  DUPLICADAS_UNIFICADAS: "batidas duplicadas",
  BATIDA_FIM_DE_SEMANA: "batida em fim de semana",
  BATIDA_EM_FERIADO: "batida em feriado",
};

export interface ItemHistorico {
  id: number;
  quando: string;
  quem: string;
  texto: string;
  motivo: string;
  desfeito: boolean;
  /** Dá para desfazer (cancelar) este lançamento. */
  reversivel: boolean;
}

function horaDoAlvo(l: { alvo: { batidaId: number } | { lancamentoId: number } }, dia: ResultadoDia): string {
  const ref = "batidaId" in l.alvo ? `c${l.alvo.batidaId}` : `m${l.alvo.lancamentoId}`;
  const b = dia.batidas.find((x) => x.ref === ref);
  return b ? (b.horaOriginal ?? b.hora) : "?";
}

function descrever(l: Lancamento, dia: ResultadoDia, todos: Lancamento[]): string {
  switch (l.tipo) {
    case "adicionar_batida":
      return `Adicionou ${NOME_TIPO[l.tipoBatida].toLowerCase()} às ${horaDeSeg(l.horaSeg)}`;
    case "alterar_horario":
      return `Alterou a batida das ${horaDoAlvo(l, dia)} para ${horaDeSeg(l.horaSeg)}`;
    case "desconsiderar_batida":
      return `Desconsiderou a batida das ${horaDoAlvo(l, dia)}`;
    case "trocar_tipo":
      return `Marcou a batida das ${horaDoAlvo(l, dia)} como ${NOME_TIPO[l.tipoBatida].toLowerCase()}`;
    case "ocorrencia":
      return `Lançou ${NOME_OCORRENCIA[l.ocorrencia].toLowerCase()}`;
    case "resolver_pendencia":
      return `Resolveu: ${NOME_PENDENCIA[l.codigo] ?? l.codigo}`;
    case "cancelar": {
      const alvo = todos.find((x) => x.id === l.lancamentoAlvoId);
      return `Desfez: ${alvo ? descrever(alvo, dia, todos).replace(/^./, (c) => c.toLowerCase()) : `lançamento ${l.lancamentoAlvoId}`}`;
    }
  }
}

export function historicoDoDia(lancamentos: Lancamento[], dia: ResultadoDia): ItemHistorico[] {
  const vigentes = new Set(lancamentosEmVigor(lancamentos).map((l) => l.id));
  return [...lancamentos]
    .sort((a, b) => b.id - a.id)
    .map((l) => ({
      id: l.id,
      quando: new Date(l.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }),
      quem: l.autorNome ?? "—",
      texto: descrever(l, dia, lancamentos),
      motivo: l.motivo,
      desfeito: l.tipo !== "cancelar" && !vigentes.has(l.id),
      reversivel: l.tipo !== "cancelar" && vigentes.has(l.id),
    }));
}
