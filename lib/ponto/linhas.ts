/** Conversão das linhas do banco para os tipos do motor. Puro: serve ao app e aos scripts. */
import type { Tables } from "@/lib/supabase/database.types";

import type { CodigoPendencia, Lancamento } from "./dia";
import type { Regras } from "./regras";

export function regrasDaLinha(l: Tables<"regras_ponto">): Regras {
  return {
    cargaSegQuiMin: l.carga_seg_qui_min,
    cargaSexMin: l.carga_sex_min,
    entradaPrevistaMin: l.entrada_prevista_min,
    almocoInicioPrevistoMin: l.almoco_inicio_previsto_min,
    almocoPadraoMin: l.almoco_padrao_min,
    horaCorteMin: l.hora_corte_min,
    toleranciaCorteMin: l.tolerancia_corte_min,
    toleranciaAtrasoMin: l.tolerancia_atraso_min,
    janelaDuplicadaMin: l.janela_duplicada_min,
  };
}

export function lancamentoDaLinha(l: Tables<"ponto_lancamentos">, nomes: Map<string, string>): Lancamento & { data: string } {
  const base = { id: l.id, data: l.data, motivo: l.motivo, criadoEm: l.criado_em, autorNome: nomes.get(l.autor) ?? null, solicitacaoId: l.solicitacao_id };
  const alvo = l.batida_id != null ? { batidaId: l.batida_id } : { lancamentoId: l.lancamento_alvo_id! };
  switch (l.tipo) {
    case "adicionar_batida":
      return { ...base, tipo: l.tipo, horaSeg: l.hora_seg!, tipoBatida: l.tipo_batida! };
    case "alterar_horario":
      return { ...base, tipo: l.tipo, alvo, horaSeg: l.hora_seg! };
    case "desconsiderar_batida":
      return { ...base, tipo: l.tipo, alvo };
    case "trocar_tipo":
      return { ...base, tipo: l.tipo, alvo, tipoBatida: l.tipo_batida! };
    case "ocorrencia":
      return { ...base, tipo: l.tipo, ocorrencia: l.ocorrencia! };
    case "resolver_pendencia":
      return { ...base, tipo: l.tipo, codigo: l.pendencia_codigo as CodigoPendencia, assinatura: l.assinatura! };
    case "cancelar":
      return { ...base, tipo: l.tipo, lancamentoAlvoId: l.lancamento_alvo_id! };
  }
}
