-- =====================================================================
-- Auditoria de segurança de 24/10/2026. Testes: tests/rls/cobertura.test.ts (permissões, lidas do catálogo)
-- e tests/rls/seguranca.test.ts (pedido de correção pela API direta).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Permissões que o Postgres 17 do Supabase concede sozinho a todo objeto novo do public:
--    MAINTAIN (VACUUM, REINDEX, LOCK TABLE…), TRUNCATE/TRIGGER/REFERENCES na view e UPDATE (setval) nas
--    sequências. Nas tabelas o TRUNCATE já era revogado a cada migração; a view e o resto tinham escapado.
--    Daqui em diante, objeto novo já nasce sem eles (default privileges do dono das migrações).
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger, maintain on all tables in schema public from authenticated;
revoke update on all sequences in schema public from authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger, maintain on tables from authenticated;
alter default privileges for role postgres in schema public revoke update on sequences from authenticated;

-- ---------------------------------------------------------------------
-- 2) Pedido de correção pela API direta (a funcionária tem o próprio JWT): o banco repete o que o app garante.
--    - anexo só no formato que o app grava (<funcionaria>/<data>-<uuid>.<ext>) e que exista no Storage:
--      antes só a pasta era conferida, e "<id>/../../qualquer-rota" virava um link no painel da gestora;
--    - data de criação é a do banco, não a que vier no pedido;
--    - motivo com o mesmo limite do formulário;
--    - um pedido pendente por batida (ou por ocorrência) no dia.
-- ---------------------------------------------------------------------
create or replace function public.valida_solicitacao()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pendente' or new.resposta is not null or new.respondida_por is not null or new.respondida_em is not null then
      raise exception 'Solicitação nova precisa estar pendente e sem resposta.' using errcode = 'P0001';
    end if;
    if new.data > (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'Não dá para pedir correção de um dia que ainda não chegou.' using errcode = 'P0001';
    end if;
    if public.semana_fechada(new.data) then
      raise exception 'A semana de % já foi fechada. Fale com a gestora.', to_char(public.segunda_de(new.data), 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
    if new.anexo_path is not null and (
      new.anexo_path !~ ('^' || new.funcionaria_id::text || '/' || to_char(new.data, 'YYYY-MM-DD')
                         || '-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|pdf)$')
      or not exists (select 1 from storage.objects o where o.bucket_id = 'anexos' and o.name = new.anexo_path)
    ) then
      raise exception 'Anexo fora da pasta da funcionária.' using errcode = 'P0001';
    end if;
    new.criada_em := now();
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

alter table public.solicitacoes_correcao add constraint solicitacao_motivo_tamanho check (length(motivo) <= 500);

create unique index solicitacao_pendente_batida on public.solicitacoes_correcao (funcionaria_id, data, tipo_batida)
  where status = 'pendente' and tipo_batida is not null;
create unique index solicitacao_pendente_ocorrencia on public.solicitacoes_correcao (funcionaria_id, data)
  where status = 'pendente' and ocorrencia is not null;
