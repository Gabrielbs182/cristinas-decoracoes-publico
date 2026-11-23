-- =====================================================================
-- 0.6 — Equipe, acessos e regras.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Nome exibido: quem tem acesso escolhe como aparece. Para a funcionária, o perfil e o cadastro andam
-- juntos (o cadastro é o que todas as telas, PDFs e planilhas usam).
-- ---------------------------------------------------------------------
create function public.alterar_meu_nome(p_nome text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_nome text := regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_funcionaria uuid;
begin
  if not public.tem_perfil() then
    raise exception 'Sem acesso ativo.' using errcode = '42501';
  end if;
  if length(v_nome) < 2 or length(v_nome) > 40 then
    raise exception 'O nome precisa ter de 2 a 40 letras.' using errcode = 'P0001';
  end if;
  update public.perfis set nome = v_nome where id = auth.uid() returning funcionaria_id into v_funcionaria;
  if v_funcionaria is not null then
    update public.funcionarias set nome_exibicao = v_nome where id = v_funcionaria;
  end if;
end;
$$;

revoke execute on function public.alterar_meu_nome(text) from public, anon;
grant execute on function public.alterar_meu_nome(text) to authenticated;

-- Com acesso ativo, o nome de exibição é dela: a gestora edita o resto do cadastro, não o nome.
-- Sem usuário na sessão (scripts com a chave de serviço) passa.
create function public.protege_nome_exibicao()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_dona uuid;
begin
  if new.nome_exibicao is distinct from old.nome_exibicao and auth.uid() is not null then
    select id into v_dona from public.perfis where funcionaria_id = new.id and ativo;
    if v_dona is not null and v_dona <> auth.uid() then
      raise exception 'O nome de exibição é escolhido pela própria funcionária, no celular.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger funcionarias_nome_exibicao before update on public.funcionarias
  for each row execute function public.protege_nome_exibicao();

-- ---------------------------------------------------------------------
-- Sempre fica ao menos uma gestora com acesso (senão ninguém administra mais nada).
-- ---------------------------------------------------------------------
create function public.protege_ultima_gestora()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if old.papel = 'gestora' and old.ativo and (new.papel <> 'gestora' or not new.ativo)
     and not exists (select 1 from public.perfis where papel = 'gestora' and ativo and id <> old.id) then
    raise exception 'Precisa ficar ao menos uma gestora com acesso.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger perfis_ultima_gestora before update on public.perfis
  for each row execute function public.protege_ultima_gestora();

-- ---------------------------------------------------------------------
-- Feriado de semana fechada não muda: a semana já foi apurada com ele (ou sem ele).
-- ---------------------------------------------------------------------
create function public.protege_feriado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_data date := case when tg_op = 'DELETE' then old.data else new.data end;
begin
  if public.semana_fechada(v_data) then
    raise exception 'A semana de % já foi fechada. Reabra a semana antes de mudar o feriado.', to_char(public.segunda_de(v_data), 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger feriados_semana_fechada before insert or delete on public.feriados
  for each row execute function public.protege_feriado();

-- ---------------------------------------------------------------------
-- Regras de jornada: valem a partir da primeira semana ainda não fechada. Semanas fechadas guardam as
-- regras da época (semanas.regras) e não são recalculadas.
-- ---------------------------------------------------------------------
create function public.definir_regras(p jsonb)
returns date
language plpgsql
security definer set search_path = ''
as $$
declare
  v_desde date;
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora pode mudar as regras.' using errcode = '42501';
  end if;
  select max(segunda) + 7 into v_desde from public.semanas where status = 'fechada';
  if v_desde is null then
    select min(vigente_desde) into v_desde from public.regras_ponto;
  end if;
  if v_desde is null then
    v_desde := public.segunda_de((now() at time zone 'America/Sao_Paulo')::date);
  end if;

  -- Versões marcadas para depois disso ficaram para trás: todas essas semanas estão abertas.
  delete from public.regras_ponto where vigente_desde > v_desde;

  insert into public.regras_ponto (
    vigente_desde, carga_seg_qui_min, carga_sex_min, entrada_prevista_min, almoco_inicio_previsto_min, almoco_padrao_min,
    hora_corte_min, tolerancia_corte_min, tolerancia_atraso_min, janela_duplicada_min, criado_por
  ) values (
    v_desde,
    (p ->> 'carga_seg_qui_min')::integer,
    (p ->> 'carga_sex_min')::integer,
    (p ->> 'entrada_prevista_min')::integer,
    (p ->> 'almoco_inicio_previsto_min')::integer,
    (p ->> 'almoco_padrao_min')::integer,
    (p ->> 'hora_corte_min')::integer,
    (p ->> 'tolerancia_corte_min')::integer,
    (p ->> 'tolerancia_atraso_min')::integer,
    (p ->> 'janela_duplicada_min')::integer,
    auth.uid()
  )
  on conflict (vigente_desde) do update set
    carga_seg_qui_min = excluded.carga_seg_qui_min,
    carga_sex_min = excluded.carga_sex_min,
    entrada_prevista_min = excluded.entrada_prevista_min,
    almoco_inicio_previsto_min = excluded.almoco_inicio_previsto_min,
    almoco_padrao_min = excluded.almoco_padrao_min,
    hora_corte_min = excluded.hora_corte_min,
    tolerancia_corte_min = excluded.tolerancia_corte_min,
    tolerancia_atraso_min = excluded.tolerancia_atraso_min,
    janela_duplicada_min = excluded.janela_duplicada_min,
    criado_por = excluded.criado_por,
    criado_em = now();
  return v_desde;
end;
$$;

revoke execute on function public.definir_regras(jsonb) from public, anon;
grant execute on function public.definir_regras(jsonb) to authenticated;
