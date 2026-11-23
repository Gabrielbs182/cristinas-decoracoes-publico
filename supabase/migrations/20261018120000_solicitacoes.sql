-- =====================================================================
-- 0.5 — Pedidos de correção das funcionárias e anexos (foto do atestado).
-- =====================================================================

-- Pedido novo: só de dia que já passou, de semana aberta, com anexo na pasta da própria funcionária.
create or replace function public.valida_solicitacao()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pendente' or new.resposta is not null or new.respondida_por is not null then
      raise exception 'Solicitação nova precisa estar pendente e sem resposta.' using errcode = 'P0001';
    end if;
    if new.data > (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'Não dá para pedir correção de um dia que ainda não chegou.' using errcode = 'P0001';
    end if;
    if public.semana_fechada(new.data) then
      raise exception 'A semana de % já foi fechada. Fale com a gestora.', to_char(public.segunda_de(new.data), 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
    if new.anexo_path is not null and split_part(new.anexo_path, '/', 1) <> new.funcionaria_id::text then
      raise exception 'Anexo fora da pasta da funcionária.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- UPDATE: só a resposta muda, e só uma vez.
  if old.status <> 'pendente' then
    raise exception 'Esta solicitação já foi respondida.' using errcode = 'P0001';
  end if;
  if new.status = 'pendente' then
    raise exception 'A resposta precisa aprovar ou recusar a solicitação.' using errcode = 'P0001';
  end if;
  if (new.funcionaria_id, new.data, new.tipo_batida, new.hora_seg, new.ocorrencia, new.motivo,
      new.anexo_path, new.criada_por, new.criada_em)
     is distinct from
     (old.funcionaria_id, old.data, old.tipo_batida, old.hora_seg, old.ocorrencia, old.motivo,
      old.anexo_path, old.criada_por, old.criada_em) then
    raise exception 'Só a resposta da solicitação pode ser alterada.' using errcode = 'P0001';
  end if;
  new.respondida_por := auth.uid();
  new.respondida_em := now();
  return new;
end;
$$;

-- Aprovar: aplica exatamente o que foi pedido e responde, tudo ou nada.
-- O servidor decide SE a batida é nova (adicionar) ou já existe com outro horário (alterar);
-- aqui o banco garante que o lançamento corresponde ao pedido.
create function public.aprovar_solicitacao(p_id bigint, p_lancamento jsonb, p_resposta text)
returns bigint
language plpgsql
security invoker set search_path = ''
as $$
declare
  s public.solicitacoes_correcao;
  v_tipo text := p_lancamento ->> 'tipo';
  v_id bigint;
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora pode aprovar solicitações.' using errcode = '42501';
  end if;
  select * into s from public.solicitacoes_correcao where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada.' using errcode = 'P0001';
  end if;
  if s.status <> 'pendente' then
    raise exception 'Esta solicitação já foi respondida.' using errcode = 'P0001';
  end if;

  if s.ocorrencia is not null then
    if v_tipo <> 'ocorrencia' or (p_lancamento ->> 'ocorrencia') is distinct from s.ocorrencia::text then
      raise exception 'O lançamento não corresponde à ocorrência pedida.' using errcode = 'P0001';
    end if;
  else
    if v_tipo not in ('adicionar_batida', 'alterar_horario')
       or (p_lancamento ->> 'hora_seg')::integer is distinct from s.hora_seg
       or (v_tipo = 'adicionar_batida' and (p_lancamento ->> 'tipo_batida') is distinct from s.tipo_batida::text) then
      raise exception 'O lançamento não corresponde à batida pedida.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.ponto_lancamentos (
    funcionaria_id, data, tipo, batida_id, lancamento_alvo_id, hora_seg, tipo_batida, ocorrencia, motivo, solicitacao_id, autor
  ) values (
    s.funcionaria_id, s.data, v_tipo::public.tipo_lancamento,
    (p_lancamento ->> 'batida_id')::bigint,
    (p_lancamento ->> 'lancamento_alvo_id')::bigint,
    (p_lancamento ->> 'hora_seg')::integer,
    (p_lancamento ->> 'tipo_batida')::public.tipo_batida,
    (p_lancamento ->> 'ocorrencia')::public.tipo_ocorrencia,
    'Pedido da funcionária: ' || s.motivo,
    s.id,
    auth.uid()
  )
  returning id into v_id;

  update public.solicitacoes_correcao
     set status = 'aprovada', resposta = coalesce(nullif(trim(p_resposta), ''), 'Aprovado.')
   where id = p_id;
  return v_id;
end;
$$;

revoke execute on function public.aprovar_solicitacao(bigint, jsonb, text) from public, anon;
grant execute on function public.aprovar_solicitacao(bigint, jsonb, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Anexos (foto do atestado etc.). Caminho: <funcionaria_id>/<arquivo>
-- Dado de saúde: só a própria funcionária e a gestora leem. Sem exclusão pela API.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy anexos_funcionaria_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select public.funcionaria_atual())::text);

create policy anexos_funcionaria_le on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select public.funcionaria_atual())::text);

create policy anexos_gestora_le on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (select public.eh_gestora()));
