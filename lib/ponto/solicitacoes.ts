/**
 * Pedidos de correção das funcionárias: o que a aprovação faz no dia e como a pendência aparece
 * para quem bateu o ponto. Puro (sem banco).
 */
import { type CodigoPendencia, NOME_OCORRENCIA, NOME_TIPO, type Ocorrencia, type Pendencia, type ResultadoDia, type TipoBatida } from "./dia";
import { diaMes, horaDeSeg } from "./tempo";

export interface Pedido {
  tipo_batida: TipoBatida | null;
  hora_seg: number | null;
  ocorrencia: Ocorrencia | null;
}

/** Lançamento que a aprovação grava (mesmo formato aceito por `aprovar_solicitacao`). */
export interface PlanoAprovacao {
  lancamento: {
    tipo: "adicionar_batida" | "alterar_horario" | "ocorrencia";
    batida_id?: number;
    lancamento_alvo_id?: number;
    hora_seg?: number;
    tipo_batida?: TipoBatida;
    ocorrencia?: Ocorrencia;
  };
  descricao: string;
}

/**
 * Batida pedida que já existe no dia (mesmo tipo) → alterar o horário dela (o original fica visível).
 * Que ainda não existe → adicionar. Ocorrência → lançar a ocorrência.
 */
export function planoDeAprovacao(dia: ResultadoDia, p: Pedido): PlanoAprovacao {
  if (p.ocorrencia) {
    return { lancamento: { tipo: "ocorrencia", ocorrencia: p.ocorrencia }, descricao: `Lança ${NOME_OCORRENCIA[p.ocorrencia].toLowerCase()} no dia` };
  }
  if (!p.tipo_batida || p.hora_seg == null) throw new Error("Pedido sem batida nem ocorrência.");
  const nome = NOME_TIPO[p.tipo_batida].toLowerCase();
  const existente = dia.batidas.find((b) => b.tipo === p.tipo_batida && !b.excedente && !b.desconsiderada);
  if (existente) {
    const id = Number(existente.ref.slice(1));
    return {
      lancamento: {
        tipo: "alterar_horario",
        ...(existente.ref.startsWith("c") ? { batida_id: id } : { lancamento_alvo_id: id }),
        hora_seg: p.hora_seg,
      },
      descricao: `Altera a ${nome} de ${existente.hora} para ${horaDeSeg(p.hora_seg)}`,
    };
  }
  return {
    lancamento: { tipo: "adicionar_batida", hora_seg: p.hora_seg, tipo_batida: p.tipo_batida },
    descricao: `Adiciona a ${nome} às ${horaDeSeg(p.hora_seg)}`,
  };
}

export function descricaoDoPedido(p: Pedido): string {
  if (p.ocorrencia) return NOME_OCORRENCIA[p.ocorrencia];
  return `${NOME_TIPO[p.tipo_batida!]} às ${horaDeSeg(p.hora_seg!)}`;
}

/** Tipo de batida que resolve a pendência (para abrir o pedido já preenchido). */
const BATIDA_QUE_FALTA: Partial<Record<CodigoPendencia, TipoBatida>> = {
  FALTA_VOLTA_ALMOCO: "V",
  FALTA_SAIDA_ALMOCO: "A",
  FALTA_SAIDA: "S",
  FALTA_ALMOCO: "A",
  SAIU_NO_ALMOCO: "V",
  BATIDA_UNICA: "S",
};

const TEXTO: Partial<Record<CodigoPendencia, string>> = {
  FALTA_VOLTA_ALMOCO: "Você esqueceu de bater a volta do almoço",
  FALTA_SAIDA_ALMOCO: "Você esqueceu de bater a saída para o almoço",
  FALTA_SAIDA: "Você esqueceu de bater a saída",
  FALTA_ALMOCO: "Faltaram as batidas do almoço",
  SAIU_NO_ALMOCO: "Você saiu para o almoço e não há batida de volta",
  BATIDA_UNICA: "Há só uma batida no dia",
  MAIS_DE_4_BATIDAS: "Há batidas a mais no dia",
  CLASSIFICACAO_INCERTA: "Suas batidas do dia precisam de revisão",
};

export interface PendenciaDaFuncionaria {
  data: string;
  codigo: CodigoPendencia;
  texto: string;
  batidas: string[];
  /** Batida a pedir no formulário pré-preenchido (sem = a gestora resolve). */
  tipoSugerido: TipoBatida | null;
}

/** Só o que bloqueia e que ela consegue ajudar a resolver; aviso (atraso etc.) fica com a gestora. */
export function pendenciasParaFuncionaria(dias: ResultadoDia[]): PendenciaDaFuncionaria[] {
  return dias.flatMap((d) =>
    d.pendencias
      .filter((p: Pendencia) => p.severidade === "bloqueia")
      .map((p) => ({
        data: d.data,
        codigo: p.codigo,
        texto: `${TEXTO[p.codigo] ?? p.titulo} em ${diaMes(d.data)}.`,
        batidas: d.batidas.filter((b) => b.tipo !== null).map((b) => b.hora),
        tipoSugerido: BATIDA_QUE_FALTA[p.codigo] ?? null,
      })),
  );
}

/** Link do anexo de um pedido. Cada parte do caminho vai codificada: o caminho vem do banco, não vira rota. */
export const enderecoDoAnexo = (caminho: string) => `/arquivos/anexo/${caminho.split("/").map(encodeURIComponent).join("/")}`;
