export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ajustes_saldo: {
        Row: {
          autor: string
          criado_em: string
          funcionaria_id: string
          id: number
          minutos: number
          motivo: string
          segunda: string
        }
        Insert: {
          autor?: string
          criado_em?: string
          funcionaria_id: string
          id?: never
          minutos: number
          motivo: string
          segunda: string
        }
        Update: {
          autor?: string
          criado_em?: string
          funcionaria_id?: string
          id?: never
          minutos?: number
          motivo?: string
          segunda?: string
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_saldo_funcionaria_id_fkey"
            columns: ["funcionaria_id"]
            isOneToOne: false
            referencedRelation: "funcionarias"
            referencedColumns: ["id"]
          },
        ]
      }
      batidas: {
        Row: {
          criado_em: string
          data: string
          en_no: string
          funcionaria_id: string | null
          hora_seg: number
          id: number
          importacao_id: string | null
          iomd: number | null
        }
        Insert: {
          criado_em?: string
          data: string
          en_no: string
          funcionaria_id?: string | null
          hora_seg: number
          id?: never
          importacao_id?: string | null
          iomd?: number | null
        }
        Update: {
          criado_em?: string
          data?: string
          en_no?: string
          funcionaria_id?: string | null
          hora_seg?: number
          id?: never
          importacao_id?: string | null
          iomd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batidas_funcionaria_id_fkey"
            columns: ["funcionaria_id"]
            isOneToOne: false
            referencedRelation: "funcionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batidas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      catraca_ids_ignorados: {
        Row: {
          autor: string
          criado_em: string
          en_no: string
          motivo: string
        }
        Insert: {
          autor?: string
          criado_em?: string
          en_no: string
          motivo: string
        }
        Update: {
          autor?: string
          criado_em?: string
          en_no?: string
          motivo?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          documento: string
          email: string
          id: string
          nome: string
          obra_bairro: string
          obra_cidade: string
          obra_endereco: string
          observacoes: string
          residencia_bairro: string
          residencia_cidade: string
          residencia_endereco: string
          telefone: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          documento?: string
          email?: string
          id?: string
          nome: string
          obra_bairro?: string
          obra_cidade?: string
          obra_endereco?: string
          observacoes?: string
          residencia_bairro?: string
          residencia_cidade?: string
          residencia_endereco?: string
          telefone?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          documento?: string
          email?: string
          id?: string
          nome?: string
          obra_bairro?: string
          obra_cidade?: string
          obra_endereco?: string
          observacoes?: string
          residencia_bairro?: string
          residencia_cidade?: string
          residencia_endereco?: string
          telefone?: string
        }
        Relationships: []
      }
      empresa: {
        Row: {
          chave_pix: string
          cidade_uf: string
          cnpj: string
          email: string
          endereco: string
          id: boolean
          logo_path: string | null
          nome_fantasia: string
          razao_social: string
          telefone: string
        }
        Insert: {
          chave_pix?: string
          cidade_uf?: string
          cnpj?: string
          email?: string
          endereco?: string
          id?: boolean
          logo_path?: string | null
          nome_fantasia?: string
          razao_social?: string
          telefone?: string
        }
        Update: {
          chave_pix?: string
          cidade_uf?: string
          cnpj?: string
          email?: string
          endereco?: string
          id?: boolean
          logo_path?: string | null
          nome_fantasia?: string
          razao_social?: string
          telefone?: string
        }
        Relationships: []
      }
      feriados: {
        Row: {
          data: string
          nome: string
          tipo: string
        }
        Insert: {
          data: string
          nome: string
          tipo: string
        }
        Update: {
          data?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      funcionarias: {
        Row: {
          ativa: boolean
          carga_seg_qui_min: number | null
          carga_sex_min: number | null
          criado_em: string
          en_no: string | null
          id: string
          nome: string
          nome_exibicao: string
        }
        Insert: {
          ativa?: boolean
          carga_seg_qui_min?: number | null
          carga_sex_min?: number | null
          criado_em?: string
          en_no?: string | null
          id?: string
          nome: string
          nome_exibicao: string
        }
        Update: {
          ativa?: boolean
          carga_seg_qui_min?: number | null
          carga_sex_min?: number | null
          criado_em?: string
          en_no?: string | null
          id?: string
          nome?: string
          nome_exibicao?: string
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          arquivo_nome: string
          arquivo_sha256: string
          batidas_novas: number
          batidas_repetidas: number
          batidas_semana_fechada: number
          id: string
          importado_em: string
          importado_por: string
          linhas_com_erro: Json
          linhas_lidas: number
          periodo_fim: string | null
          periodo_inicio: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_sha256: string
          batidas_novas: number
          batidas_repetidas: number
          batidas_semana_fechada?: number
          id?: string
          importado_em?: string
          importado_por?: string
          linhas_com_erro?: Json
          linhas_lidas: number
          periodo_fim?: string | null
          periodo_inicio?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_sha256?: string
          batidas_novas?: number
          batidas_repetidas?: number
          batidas_semana_fechada?: number
          id?: string
          importado_em?: string
          importado_por?: string
          linhas_com_erro?: Json
          linhas_lidas?: number
          periodo_fim?: string | null
          periodo_inicio?: string | null
        }
        Relationships: []
      }
      modelos_confeccao: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          fator_franzimento: number
          id: string
          nome: string
          preco_metro_centavos: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          fator_franzimento: number
          id?: string
          nome: string
          preco_metro_centavos: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          fator_franzimento?: number
          id?: string
          nome?: string
          preco_metro_centavos?: number
        }
        Relationships: []
      }
      numeracao: {
        Row: {
          proximo: number
          tipo: string
        }
        Insert: {
          proximo: number
          tipo: string
        }
        Update: {
          proximo?: number
          tipo?: string
        }
        Relationships: []
      }
      orcamento_ambientes: {
        Row: {
          id: string
          nome: string
          orcamento_id: string
          ordem: number
        }
        Insert: {
          id: string
          nome: string
          orcamento_id: string
          ordem: number
        }
        Update: {
          id?: string
          nome?: string
          orcamento_id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_ambientes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_ambientes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "saldos_orcamentos"
            referencedColumns: ["orcamento_id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          altura_cm: number | null
          ambiente_id: string
          cor: string
          descricao: string
          id: string
          instalacao_id: string | null
          largura_cm: number | null
          linhas: Json
          medidas: string
          modelo_id: string | null
          motor_id: string | null
          motorizado: boolean
          orcamento_id: string
          ordem: number
          precos: Json
          produto_id: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_item_orcamento"]
          total_centavos: number
          trilho_id: string | null
          unitario_centavos: number
        }
        Insert: {
          altura_cm?: number | null
          ambiente_id: string
          cor?: string
          descricao: string
          id: string
          instalacao_id?: string | null
          largura_cm?: number | null
          linhas: Json
          medidas?: string
          modelo_id?: string | null
          motor_id?: string | null
          motorizado?: boolean
          orcamento_id: string
          ordem: number
          precos: Json
          produto_id?: string | null
          quantidade?: number
          tipo: Database["public"]["Enums"]["tipo_item_orcamento"]
          total_centavos: number
          trilho_id?: string | null
          unitario_centavos: number
        }
        Update: {
          altura_cm?: number | null
          ambiente_id?: string
          cor?: string
          descricao?: string
          id?: string
          instalacao_id?: string | null
          largura_cm?: number | null
          linhas?: Json
          medidas?: string
          modelo_id?: string | null
          motor_id?: string | null
          motorizado?: boolean
          orcamento_id?: string
          ordem?: number
          precos?: Json
          produto_id?: string | null
          quantidade?: number
          tipo?: Database["public"]["Enums"]["tipo_item_orcamento"]
          total_centavos?: number
          trilho_id?: string | null
          unitario_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "orcamento_ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_confeccao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_motor_id_fkey"
            columns: ["motor_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "saldos_orcamentos"
            referencedColumns: ["orcamento_id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_trilho_id_fkey"
            columns: ["trilho_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          aprovado_pelo_link: boolean
          atualizado_em: string
          cliente_id: string
          condicoes_pagamento: string
          criado_em: string
          criado_por: string | null
          desconto_centavos: number
          desconto_modo: string
          desconto_valor: number
          deslocamento_centavos: number
          endereco_obra: string
          enviado_em: string | null
          id: string
          numero: number
          obs_cliente: string
          obs_interna: string
          prazo_entrega: string
          respondido_em: string | null
          resposta_motivo: string
          status: Database["public"]["Enums"]["status_orcamento"]
          subtotal_centavos: number
          token: string
          total_centavos: number
          validade_dias: number
          valido_ate: string | null
        }
        Insert: {
          aprovado_pelo_link?: boolean
          atualizado_em?: string
          cliente_id: string
          condicoes_pagamento?: string
          criado_em?: string
          criado_por?: string | null
          desconto_centavos?: number
          desconto_modo?: string
          desconto_valor?: number
          deslocamento_centavos?: number
          endereco_obra?: string
          enviado_em?: string | null
          id?: string
          numero: number
          obs_cliente?: string
          obs_interna?: string
          prazo_entrega?: string
          respondido_em?: string | null
          resposta_motivo?: string
          status?: Database["public"]["Enums"]["status_orcamento"]
          subtotal_centavos?: number
          token?: string
          total_centavos?: number
          validade_dias?: number
          valido_ate?: string | null
        }
        Update: {
          aprovado_pelo_link?: boolean
          atualizado_em?: string
          cliente_id?: string
          condicoes_pagamento?: string
          criado_em?: string
          criado_por?: string | null
          desconto_centavos?: number
          desconto_modo?: string
          desconto_valor?: number
          deslocamento_centavos?: number
          endereco_obra?: string
          enviado_em?: string | null
          id?: string
          numero?: number
          obs_cliente?: string
          obs_interna?: string
          prazo_entrega?: string
          respondido_em?: string | null
          resposta_motivo?: string
          status?: Database["public"]["Enums"]["status_orcamento"]
          subtotal_centavos?: number
          token?: string
          total_centavos?: number
          validade_dias?: number
          valido_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          criado_em: string
          funcionaria_id: string | null
          id: string
          nome: string
          papel: Database["public"]["Enums"]["papel"]
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          funcionaria_id?: string | null
          id: string
          nome: string
          papel: Database["public"]["Enums"]["papel"]
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          funcionaria_id?: string | null
          id?: string
          nome?: string
          papel?: Database["public"]["Enums"]["papel"]
        }
        Relationships: [
          {
            foreignKeyName: "perfis_funcionaria_id_fkey"
            columns: ["funcionaria_id"]
            isOneToOne: true
            referencedRelation: "funcionarias"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_lancamentos: {
        Row: {
          assinatura: string | null
          autor: string
          batida_id: number | null
          criado_em: string
          data: string
          funcionaria_id: string
          hora_seg: number | null
          id: number
          lancamento_alvo_id: number | null
          motivo: string
          ocorrencia: Database["public"]["Enums"]["tipo_ocorrencia"] | null
          pendencia_codigo: string | null
          solicitacao_id: number | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          tipo_batida: Database["public"]["Enums"]["tipo_batida"] | null
        }
        Insert: {
          assinatura?: string | null
          autor?: string
          batida_id?: number | null
          criado_em?: string
          data: string
          funcionaria_id: string
          hora_seg?: number | null
          id?: never
          lancamento_alvo_id?: number | null
          motivo: string
          ocorrencia?: Database["public"]["Enums"]["tipo_ocorrencia"] | null
          pendencia_codigo?: string | null
          solicitacao_id?: number | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          tipo_batida?: Database["public"]["Enums"]["tipo_batida"] | null
        }
        Update: {
          assinatura?: string | null
          autor?: string
          batida_id?: number | null
          criado_em?: string
          data?: string
          funcionaria_id?: string
          hora_seg?: number | null
          id?: never
          lancamento_alvo_id?: number | null
          motivo?: string
          ocorrencia?: Database["public"]["Enums"]["tipo_ocorrencia"] | null
          pendencia_codigo?: string | null
          solicitacao_id?: number | null
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          tipo_batida?: Database["public"]["Enums"]["tipo_batida"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_lancamentos_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "batidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_lancamentos_funcionaria_id_fkey"
            columns: ["funcionaria_id"]
            isOneToOne: false
            referencedRelation: "funcionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_lancamentos_lancamento_alvo_id_fkey"
            columns: ["lancamento_alvo_id"]
            isOneToOne: false
            referencedRelation: "ponto_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_lancamentos_solicitacao_fk"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_correcao"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: Database["public"]["Enums"]["categoria_produto"]
          criado_em: string
          id: string
          largura_rolo_cm: number | null
          nome: string
          preco_centavos: number
          unidade: Database["public"]["Enums"]["unidade_produto"]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria: Database["public"]["Enums"]["categoria_produto"]
          criado_em?: string
          id?: string
          largura_rolo_cm?: number | null
          nome: string
          preco_centavos: number
          unidade: Database["public"]["Enums"]["unidade_produto"]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: Database["public"]["Enums"]["categoria_produto"]
          criado_em?: string
          id?: string
          largura_rolo_cm?: number | null
          nome?: string
          preco_centavos?: number
          unidade?: Database["public"]["Enums"]["unidade_produto"]
        }
        Relationships: []
      }
      recibos: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          cliente_id: string | null
          criado_em: string
          data_pagamento: string
          emitido_por: string | null
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          motivo_cancelamento: string
          numero: number
          orcamento_id: string | null
          orcamento_numero: number | null
          pagador: string
          referente: string
          status: Database["public"]["Enums"]["status_recibo"]
          tipo: Database["public"]["Enums"]["tipo_recibo"]
          valor_centavos: number
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          criado_em?: string
          data_pagamento: string
          emitido_por?: string | null
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          motivo_cancelamento?: string
          numero: number
          orcamento_id?: string | null
          orcamento_numero?: number | null
          pagador: string
          referente: string
          status?: Database["public"]["Enums"]["status_recibo"]
          tipo: Database["public"]["Enums"]["tipo_recibo"]
          valor_centavos: number
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          criado_em?: string
          data_pagamento?: string
          emitido_por?: string | null
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          motivo_cancelamento?: string
          numero?: number
          orcamento_id?: string | null
          orcamento_numero?: number | null
          pagador?: string
          referente?: string
          status?: Database["public"]["Enums"]["status_recibo"]
          tipo?: Database["public"]["Enums"]["tipo_recibo"]
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "recibos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "saldos_orcamentos"
            referencedColumns: ["orcamento_id"]
          },
        ]
      }
      regras_orcamento: {
        Row: {
          area_minima_persiana_cm2: number
          atualizado_em: string
          atualizado_por: string | null
          condicoes_padrao: string
          id: boolean
          prazo_entrega_padrao: string
          sobra_trilho_cm: number
          validade_padrao_dias: number
        }
        Insert: {
          area_minima_persiana_cm2?: number
          atualizado_em?: string
          atualizado_por?: string | null
          condicoes_padrao?: string
          id?: boolean
          prazo_entrega_padrao?: string
          sobra_trilho_cm?: number
          validade_padrao_dias?: number
        }
        Update: {
          area_minima_persiana_cm2?: number
          atualizado_em?: string
          atualizado_por?: string | null
          condicoes_padrao?: string
          id?: boolean
          prazo_entrega_padrao?: string
          sobra_trilho_cm?: number
          validade_padrao_dias?: number
        }
        Relationships: []
      }
      regras_ponto: {
        Row: {
          almoco_inicio_previsto_min: number
          almoco_padrao_min: number
          carga_seg_qui_min: number
          carga_sex_min: number
          criado_em: string
          criado_por: string | null
          entrada_prevista_min: number
          hora_corte_min: number
          id: number
          janela_duplicada_min: number
          tolerancia_atraso_min: number
          tolerancia_corte_min: number
          vigente_desde: string
        }
        Insert: {
          almoco_inicio_previsto_min?: number
          almoco_padrao_min?: number
          carga_seg_qui_min?: number
          carga_sex_min?: number
          criado_em?: string
          criado_por?: string | null
          entrada_prevista_min?: number
          hora_corte_min?: number
          id?: never
          janela_duplicada_min?: number
          tolerancia_atraso_min?: number
          tolerancia_corte_min?: number
          vigente_desde: string
        }
        Update: {
          almoco_inicio_previsto_min?: number
          almoco_padrao_min?: number
          carga_seg_qui_min?: number
          carga_sex_min?: number
          criado_em?: string
          criado_por?: string | null
          entrada_prevista_min?: number
          hora_corte_min?: number
          id?: never
          janela_duplicada_min?: number
          tolerancia_atraso_min?: number
          tolerancia_corte_min?: number
          vigente_desde?: string
        }
        Relationships: []
      }
      semana_eventos: {
        Row: {
          acao: string
          autor: string
          em: string
          id: number
          motivo: string | null
          segunda: string
        }
        Insert: {
          acao: string
          autor?: string
          em?: string
          id?: never
          motivo?: string | null
          segunda: string
        }
        Update: {
          acao?: string
          autor?: string
          em?: string
          id?: never
          motivo?: string | null
          segunda?: string
        }
        Relationships: [
          {
            foreignKeyName: "semana_eventos_segunda_fkey"
            columns: ["segunda"]
            isOneToOne: false
            referencedRelation: "semanas"
            referencedColumns: ["segunda"]
          },
        ]
      }
      semana_resultado_dias: {
        Row: {
          ajustado: boolean
          data: string
          entrada: string | null
          extra_min: number
          funcionaria_id: string
          saida: string | null
          saida_almoco: string | null
          segunda: string
          situacao: string
          trabalhadas_min: number | null
          volta_almoco: string | null
        }
        Insert: {
          ajustado?: boolean
          data: string
          entrada?: string | null
          extra_min?: number
          funcionaria_id: string
          saida?: string | null
          saida_almoco?: string | null
          segunda: string
          situacao: string
          trabalhadas_min?: number | null
          volta_almoco?: string | null
        }
        Update: {
          ajustado?: boolean
          data?: string
          entrada?: string | null
          extra_min?: number
          funcionaria_id?: string
          saida?: string | null
          saida_almoco?: string | null
          segunda?: string
          situacao?: string
          trabalhadas_min?: number | null
          volta_almoco?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "semana_resultado_dias_segunda_funcionaria_id_fkey"
            columns: ["segunda", "funcionaria_id"]
            isOneToOne: false
            referencedRelation: "semana_resultados"
            referencedColumns: ["segunda", "funcionaria_id"]
          },
        ]
      }
      semana_resultados: {
        Row: {
          acumulado_min: number
          ajustes_min: number
          dias_trabalhados: number
          espelho_path: string | null
          extras_semana_min: number
          fechou_corte: boolean
          funcionaria_id: string
          proxima_semana_min: number
          saldo_anterior_min: number
          segunda: string
          trabalhadas_min: number
        }
        Insert: {
          acumulado_min: number
          ajustes_min?: number
          dias_trabalhados: number
          espelho_path?: string | null
          extras_semana_min: number
          fechou_corte: boolean
          funcionaria_id: string
          proxima_semana_min: number
          saldo_anterior_min: number
          segunda: string
          trabalhadas_min: number
        }
        Update: {
          acumulado_min?: number
          ajustes_min?: number
          dias_trabalhados?: number
          espelho_path?: string | null
          extras_semana_min?: number
          fechou_corte?: boolean
          funcionaria_id?: string
          proxima_semana_min?: number
          saldo_anterior_min?: number
          segunda?: string
          trabalhadas_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "semana_resultados_funcionaria_id_fkey"
            columns: ["funcionaria_id"]
            isOneToOne: false
            referencedRelation: "funcionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semana_resultados_segunda_fkey"
            columns: ["segunda"]
            isOneToOne: false
            referencedRelation: "semanas"
            referencedColumns: ["segunda"]
          },
        ]
      }
      semanas: {
        Row: {
          fechada_em: string | null
          fechada_por: string | null
          regras: Json | null
          segunda: string
          status: Database["public"]["Enums"]["status_semana"]
        }
        Insert: {
          fechada_em?: string | null
          fechada_por?: string | null
          regras?: Json | null
          segunda: string
          status?: Database["public"]["Enums"]["status_semana"]
        }
        Update: {
          fechada_em?: string | null
          fechada_por?: string | null
          regras?: Json | null
          segunda?: string
          status?: Database["public"]["Enums"]["status_semana"]
        }
        Relationships: []
      }
      solicitacoes_correcao: {
        Row: {
          anexo_path: string | null
          criada_em: string
          criada_por: string
          data: string
          funcionaria_id: string
          hora_seg: number | null
          id: number
          motivo: string
          ocorrencia: Database["public"]["Enums"]["tipo_ocorrencia"] | null
          respondida_em: string | null
          respondida_por: string | null
          resposta: string | null
          status: Database["public"]["Enums"]["status_solicitacao"]
          tipo_batida: Database["public"]["Enums"]["tipo_batida"] | null
        }
        Insert: {
          anexo_path?: string | null
          criada_em?: string
          criada_por?: string
          data: string
          funcionaria_id: string
          hora_seg?: number | null
          id?: never
          motivo: string
          ocorrencia?: Database["public"]["Enums"]["tipo_ocorrencia"] | null
          respondida_em?: string | null
          respondida_por?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao"]
          tipo_batida?: Database["public"]["Enums"]["tipo_batida"] | null
        }
        Update: {
          anexo_path?: string | null
          criada_em?: string
          criada_por?: string
          data?: string
          funcionaria_id?: string
          hora_seg?: number | null
          id?: never
          motivo?: string
          ocorrencia?: Database["public"]["Enums"]["tipo_ocorrencia"] | null
          respondida_em?: string | null
          respondida_por?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao"]
          tipo_batida?: Database["public"]["Enums"]["tipo_batida"] | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_correcao_funcionaria_id_fkey"
            columns: ["funcionaria_id"]
            isOneToOne: false
            referencedRelation: "funcionarias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      saldos_orcamentos: {
        Row: {
          cliente_id: string | null
          numero: number | null
          orcamento_id: string | null
          pago_centavos: number | null
          saldo_centavos: number | null
          total_centavos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      alterar_meu_nome: { Args: { p_nome: string }; Returns: undefined }
      aprovar_orcamento_publico: { Args: { p_token: string }; Returns: number }
      aprovar_solicitacao: {
        Args: { p_id: number; p_lancamento: Json; p_resposta: string }
        Returns: number
      }
      criar_perfil: {
        Args: {
          p_funcionaria: string
          p_nome: string
          p_papel: Database["public"]["Enums"]["papel"]
          p_usuario: string
        }
        Returns: undefined
      }
      definir_proximo_numero: {
        Args: { p_proximo: number; p_tipo: string }
        Returns: undefined
      }
      definir_regras: { Args: { p: Json }; Returns: string }
      documento_orcamento: { Args: { p_id: string }; Returns: Json }
      eh_gestora: { Args: never; Returns: boolean }
      fechar_semana: {
        Args: {
          p_dias: Json
          p_regras: Json
          p_resultados: Json
          p_segunda: string
        }
        Returns: undefined
      }
      funcionaria_atual: { Args: never; Returns: string }
      montar_documento_orcamento: { Args: { p_id: string }; Returns: Json }
      orcamento_publico: { Args: { p_token: string }; Returns: Json }
      papel_atual: {
        Args: never
        Returns: Database["public"]["Enums"]["papel"]
      }
      reabrir_semana: {
        Args: { p_motivo: string; p_segunda: string }
        Returns: undefined
      }
      salvar_orcamento: {
        Args: {
          p_ambientes: Json
          p_cabecalho: Json
          p_id: string
          p_itens: Json
        }
        Returns: string
      }
      segunda_de: { Args: { d: string }; Returns: string }
      semana_fechada: { Args: { d: string }; Returns: boolean }
      tem_perfil: { Args: never; Returns: boolean }
      vincular_id_catraca: {
        Args: { p_en_no: string; p_funcionaria: string }
        Returns: number
      }
    }
    Enums: {
      categoria_produto:
        | "tecido"
        | "persiana"
        | "trilho"
        | "acessorio"
        | "servico"
      forma_pagamento:
        | "pix"
        | "dinheiro"
        | "cartao_credito"
        | "cartao_debito"
        | "transferencia"
      papel: "gestora" | "funcionaria" | "contador"
      status_orcamento:
        | "rascunho"
        | "enviado"
        | "aprovado"
        | "recusado"
        | "cancelado"
      status_recibo: "emitido" | "cancelado"
      status_semana: "aberta" | "fechada"
      status_solicitacao: "pendente" | "aprovada" | "recusada"
      tipo_batida: "E" | "A" | "V" | "S"
      tipo_item_orcamento:
        | "cortina"
        | "persiana"
        | "trilho"
        | "acessorio"
        | "servico"
      tipo_lancamento:
        | "adicionar_batida"
        | "alterar_horario"
        | "desconsiderar_batida"
        | "trocar_tipo"
        | "ocorrencia"
        | "resolver_pendencia"
        | "cancelar"
      tipo_ocorrencia:
        | "atestado"
        | "falta_justificada"
        | "folga"
        | "feriado"
        | "falta"
      tipo_recibo: "sinal" | "parcela" | "quitacao" | "avulso"
      unidade_produto: "m" | "m2" | "un" | "vao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      categoria_produto: [
        "tecido",
        "persiana",
        "trilho",
        "acessorio",
        "servico",
      ],
      forma_pagamento: [
        "pix",
        "dinheiro",
        "cartao_credito",
        "cartao_debito",
        "transferencia",
      ],
      papel: ["gestora", "funcionaria", "contador"],
      status_orcamento: [
        "rascunho",
        "enviado",
        "aprovado",
        "recusado",
        "cancelado",
      ],
      status_recibo: ["emitido", "cancelado"],
      status_semana: ["aberta", "fechada"],
      status_solicitacao: ["pendente", "aprovada", "recusada"],
      tipo_batida: ["E", "A", "V", "S"],
      tipo_item_orcamento: [
        "cortina",
        "persiana",
        "trilho",
        "acessorio",
        "servico",
      ],
      tipo_lancamento: [
        "adicionar_batida",
        "alterar_horario",
        "desconsiderar_batida",
        "trocar_tipo",
        "ocorrencia",
        "resolver_pendencia",
        "cancelar",
      ],
      tipo_ocorrencia: [
        "atestado",
        "falta_justificada",
        "folga",
        "feriado",
        "falta",
      ],
      tipo_recibo: ["sinal", "parcela", "quitacao", "avulso"],
      unidade_produto: ["m", "m2", "un", "vao"],
    },
  },
} as const

