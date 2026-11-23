-- =====================================================================
-- Link do orçamento para a cliente expira 30 dias depois de vencer (decisão de 25/10/2026). O link mostra nome,
-- telefone e endereço da obra; depois disso, quem tiver o link encaminhado só vê que ele expirou.
-- Orçamento aprovado não vence: continua visível (a cliente revê o que aprovou). Teste: tests/rls/orcamentos.test.ts.
-- =====================================================================
create or replace function public.orcamento_publico(p_token uuid)
returns jsonb
language sql
stable security definer set search_path = ''
as $$
  select case
           when o.status in ('enviado', 'recusado') and o.valido_ate < (now() at time zone 'America/Sao_Paulo')::date - 30
             then jsonb_build_object('expirado', true, 'expirou_em', o.valido_ate + 31)
           else public.montar_documento_orcamento(o.id)
         end
    from public.orcamentos o
   where o.token = p_token and o.status in ('enviado', 'aprovado', 'recusado')
$$;
