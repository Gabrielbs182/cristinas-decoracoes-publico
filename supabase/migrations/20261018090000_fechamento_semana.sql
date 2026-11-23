-- =====================================================================
-- 0.4 — Fechamento da semana, reabertura e armazenamento dos espelhos.
--
-- O motor de cálculo é TypeScript: o servidor calcula a fotografia da semana e
-- entrega aqui. Estas funções garantem o que o banco precisa garantir sozinho:
-- quem pode, a ordem cronológica e a atomicidade (tudo ou nada).
-- =====================================================================

create function public.fechar_semana(p_segunda date, p_resultados jsonb, p_dias jsonb, p_regras jsonb)
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

create function public.reabrir_semana(p_segunda date, p_motivo text)
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

revoke execute on function public.fechar_semana(date, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.reabrir_semana(date, text) from public, anon;
grant execute on function public.fechar_semana(date, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.reabrir_semana(date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Espelhos de ponto (PDF). Caminho: <funcionaria_id>/<segunda>.pdf
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('espelhos', 'espelhos', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy espelhos_gestora on storage.objects for all to authenticated
  using (bucket_id = 'espelhos' and (select public.eh_gestora()))
  with check (bucket_id = 'espelhos' and (select public.eh_gestora()));

create policy espelhos_contador_le on storage.objects for select to authenticated
  using (bucket_id = 'espelhos' and (select public.papel_atual()) = 'contador');

create policy espelhos_funcionaria_le on storage.objects for select to authenticated
  using (bucket_id = 'espelhos' and (storage.foldername(name))[1] = (select public.funcionaria_atual())::text);
