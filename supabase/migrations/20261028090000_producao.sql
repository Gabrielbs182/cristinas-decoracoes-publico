-- =====================================================================
-- Preparação para a produção (VPS). Testes: tests/rls/referencia.test.ts e tests/rls/seguranca.test.ts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Dados de referência: moravam no seed.sql, que só roda no `db reset` local. Na VPS o banco nasce só das
--    migrações — sem isto, não haveria empresa, regra de ponto vigente nem feriado. Idempotente: o banco local
--    já tem tudo isso e nada muda.
-- ---------------------------------------------------------------------
insert into public.empresa (id) values (true) on conflict do nothing;

-- Regra vigente desde a primeira semana com dados (fev/2026), igual ao script legado: seg–qui 9h, sex 8h,
-- almoço de 1h, hora de corte 8h com 10 min de tolerância. Só entra se ainda não houver regra nenhuma.
insert into public.regras_ponto (vigente_desde, criado_por)
select '2026-01-05', null where not exists (select 1 from public.regras_ponto);

-- Feriados nacionais (Sexta-feira Santa pela Páscoa de cada ano). Municipais, pontes e pontos facultativos a
-- gestora cadastra em Calendário e regras. Pula o que já existe e o que cai em semana fechada (o gatilho
-- protege_feriado dispara antes do "on conflict" e recusaria a linha repetida).
insert into public.feriados (data, nome, tipo)
select n.data, n.nome, 'nacional'
  from (
select make_date(a.ano, f.mes, f.dia) as data, f.nome
  from generate_series(2026, 2030) as a(ano)
 cross join (values
   (1, 1, 'Confraternização Universal'),
   (4, 21, 'Tiradentes'),
   (5, 1, 'Dia do Trabalho'),
   (9, 7, 'Independência do Brasil'),
   (10, 12, 'Nossa Senhora Aparecida'),
   (11, 2, 'Finados'),
   (11, 15, 'Proclamação da República'),
   (11, 20, 'Dia Nacional de Zumbi e da Consciência Negra'),
   (12, 25, 'Natal')
 ) as f(mes, dia, nome)
union all
select d::date, 'Sexta-feira Santa' from unnest(array['2026-04-03', '2027-03-26', '2028-04-14', '2029-03-30', '2030-04-19']) as d
  ) as n
 where not exists (select 1 from public.feriados x where x.data = n.data)
   and not public.semana_fechada(n.data);

-- ---------------------------------------------------------------------
-- 2) Fechamento só pelas funções. A gestora tem permissão nas tabelas porque fechar_semana/reabrir_semana rodam
--    com a sessão dela (security invoker); pela API direta ela fechava/reabria sem motivo, sem evento e fora de
--    ordem. As funções marcam a transação (cristinas.fechamento) e o gatilho recusa o resto vindo do app.
--    Continua livre: importar cria semana ABERTA; gerar o espelho grava só o espelho_path. Scripts com a chave
--    secreta (service_role) e o superusuário não passam pelo gatilho (importar-historico, anexar-pdfs-legado).
-- ---------------------------------------------------------------------
create function public.protege_fechamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' or coalesce(current_setting('cristinas.fechamento', true), '') = 'sim' then
    return coalesce(new, old);
  end if;
  -- if aninhado: o PL/pgSQL avalia new.<campo> mesmo quando a tabela é outra (e a coluna não existe nela).
  if tg_table_name = 'semanas' and tg_op = 'INSERT' then
    if new.status = 'aberta' and new.fechada_em is null then
      return new;
    end if;
  elsif tg_table_name = 'semana_resultados' and tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'espelho_path') = (to_jsonb(old) - 'espelho_path') then
      return new;
    end if;
  end if;
  raise exception 'A semana muda só pelo fechamento (Fechar semana / Reabrir semana).' using errcode = '42501';
end;
$$;

create trigger protege_fechamento before insert or update or delete on public.semanas
  for each row execute function public.protege_fechamento();
create trigger protege_fechamento before insert or update or delete on public.semana_resultados
  for each row execute function public.protege_fechamento();
create trigger protege_fechamento before insert or update or delete on public.semana_resultado_dias
  for each row execute function public.protege_fechamento();
create trigger protege_fechamento before insert or update or delete on public.semana_eventos
  for each row execute function public.protege_fechamento();

-- As duas funções: iguais às da 0.4, mais a marca da transação logo depois de conferir que é a gestora.
create or replace function public.fechar_semana(p_segunda date, p_resultados jsonb, p_dias jsonb, p_regras jsonb)
returns void
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_status public.status_semana;
  v_outra date;
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora pode fechar a semana.' using errcode = '42501';
  end if;
  perform set_config('cristinas.fechamento', 'sim', true);

  select status into v_status from public.semanas where segunda = p_segunda for update;
  if not found then
    raise exception 'A semana de % não tem batidas importadas.', to_char(p_segunda, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  if v_status = 'fechada' then
    raise exception 'A semana de % já está fechada.', to_char(p_segunda, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;

  -- Ordem cronológica: o saldo anterior desta semana é o "segue" da semana anterior fechada.
  select s.segunda into v_outra from public.semanas s
   where s.segunda < p_segunda and s.status = 'aberta'
     and exists (select 1 from public.batidas b where b.data between s.segunda and s.segunda + 6)
   order by s.segunda limit 1;
  if v_outra is not null then
    raise exception 'Feche antes a semana de %.', to_char(v_outra, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  select s.segunda into v_outra from public.semanas s
   where s.segunda > p_segunda and s.status = 'fechada'
   order by s.segunda limit 1;
  if v_outra is not null then
    raise exception 'A semana de % já está fechada; reabra-a antes de fechar uma anterior.', to_char(v_outra, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_resultados) = 0 then
    raise exception 'Fechamento sem resultados.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_dias) as d(data date) where d.data not between p_segunda and p_segunda + 6) then
    raise exception 'Há dia fora da semana no fechamento.' using errcode = 'P0001';
  end if;

  -- Resíduo de uma reabertura anterior (a reabertura já apaga, isto é só defesa).
  delete from public.semana_resultados where segunda = p_segunda;

  insert into public.semana_resultados (
    segunda, funcionaria_id, saldo_anterior_min, extras_semana_min, ajustes_min, acumulado_min,
    fechou_corte, proxima_semana_min, trabalhadas_min, dias_trabalhados, espelho_path
  )
  select p_segunda, r.funcionaria_id, r.saldo_anterior_min, r.extras_semana_min, r.ajustes_min, r.acumulado_min,
         r.fechou_corte, r.proxima_semana_min, r.trabalhadas_min, r.dias_trabalhados, r.espelho_path
    from jsonb_to_recordset(p_resultados) as r(
      funcionaria_id uuid, saldo_anterior_min integer, extras_semana_min integer, ajustes_min integer,
      acumulado_min integer, fechou_corte boolean, proxima_semana_min integer, trabalhadas_min integer,
      dias_trabalhados integer, espelho_path text
    );

  insert into public.semana_resultado_dias (
    segunda, funcionaria_id, data, entrada, saida_almoco, volta_almoco, saida, trabalhadas_min, extra_min, situacao, ajustado
  )
  select p_segunda, d.funcionaria_id, d.data, d.entrada, d.saida_almoco, d.volta_almoco, d.saida,
         d.trabalhadas_min, d.extra_min, d.situacao, d.ajustado
    from jsonb_to_recordset(p_dias) as d(
      funcionaria_id uuid, data date, entrada text, saida_almoco text, volta_almoco text, saida text,
      trabalhadas_min integer, extra_min integer, situacao text, ajustado boolean
    );

  update public.semanas
     set status = 'fechada', fechada_em = now(), fechada_por = auth.uid(), regras = p_regras
   where segunda = p_segunda;

  insert into public.semana_eventos (segunda, acao, motivo, autor) values (p_segunda, 'fechar', null, auth.uid());
end;
$$;

create or replace function public.reabrir_semana(p_segunda date, p_motivo text)
returns void
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_status public.status_semana;
  v_outra date;
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora pode reabrir a semana.' using errcode = '42501';
  end if;
  perform set_config('cristinas.fechamento', 'sim', true);
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escreva o motivo da reabertura.' using errcode = 'P0001';
  end if;

  select status into v_status from public.semanas where segunda = p_segunda for update;
  if not found or v_status <> 'fechada' then
    raise exception 'A semana de % não está fechada.', to_char(p_segunda, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  -- Só a última fechada: reabrir uma do meio quebraria o saldo das seguintes.
  select s.segunda into v_outra from public.semanas s
   where s.segunda > p_segunda and s.status = 'fechada'
   order by s.segunda limit 1;
  if v_outra is not null then
    raise exception 'Reabra antes a semana de % (só a última fechada pode ser reaberta).', to_char(v_outra, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;

  delete from public.semana_resultados where segunda = p_segunda; -- os dias vão em cascata
  update public.semanas set status = 'aberta', fechada_em = null, fechada_por = null where segunda = p_segunda;
  insert into public.semana_eventos (segunda, acao, motivo, autor) values (p_segunda, 'reabrir', trim(p_motivo), auth.uid());
end;
$$;
