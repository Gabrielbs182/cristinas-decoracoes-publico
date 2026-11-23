-- =====================================================================
-- 0.9 — Recibos (pagamentos de clientes). A gestora emite e cancela; o contador só lê.
-- Numeração sem buraco (mesmo contador dos orçamentos). Recibo não se apaga nem muda: cancela com motivo
-- e o número não volta. Recibo de orçamento só de orçamento aprovado e nunca acima do saldo — garantido
-- aqui, com o orçamento travado na transação (dois recibos ao mesmo tempo não estouram o saldo).
-- O recibo guarda o nome de quem pagou e o número do orçamento: o contador não vê clientes nem orçamentos.
-- =====================================================================

create type public.tipo_recibo as enum ('sinal', 'parcela', 'quitacao', 'avulso');
create type public.forma_pagamento as enum ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'transferencia');
create type public.status_recibo as enum ('emitido', 'cancelado');

create table public.recibos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  tipo public.tipo_recibo not null,
  orcamento_id uuid references public.orcamentos (id) on delete restrict,
  orcamento_numero integer,
  cliente_id uuid references public.clientes (id) on delete restrict,
  pagador text not null check (length(trim(pagador)) between 2 and 120),
  referente text not null check (length(trim(referente)) between 3 and 300),
  valor_centavos integer not null check (valor_centavos between 1 and 100000000),
  forma public.forma_pagamento not null,
  data_pagamento date not null,
  status public.status_recibo not null default 'emitido',
  motivo_cancelamento text not null default '' check (length(motivo_cancelamento) <= 500),
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users (id),
  emitido_por uuid references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  constraint recibo_avulso_sem_orcamento check ((tipo = 'avulso') = (orcamento_id is null))
);

create index recibos_orcamento on public.recibos (orcamento_id) where status = 'emitido';
create index recibos_data on public.recibos (data_pagamento desc);
create index recibos_cliente on public.recibos (cliente_id);

-- R$ no formato brasileiro para as mensagens (o to_char com G/D seguiria a configuração do servidor).
create function public.reais(p_centavos integer)
returns text
language sql
immutable set search_path = ''
as $$
  select 'R$ ' || translate(to_char(p_centavos / 100.0, 'FM999,999,990.00'), ',.', '.,')
$$;

-- ---------------------------------------------------------------------
-- Emissão: número, orçamento aprovado, saldo, data.
-- ---------------------------------------------------------------------
create function public.emite_recibo()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  o public.orcamentos;
  v_pago integer;
  v_saldo integer;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.status <> 'emitido' or new.cancelado_em is not null or new.motivo_cancelamento <> '' then
    raise exception 'Recibo novo nasce emitido.' using errcode = 'P0001';
  end if;
  if new.data_pagamento > hoje then
    raise exception 'A data do pagamento não pode ser futura.' using errcode = 'P0001';
  end if;

  if new.orcamento_id is not null then
    -- Trava o orçamento: outro recibo do mesmo orçamento espera este terminar (o saldo não estoura).
    select * into o from public.orcamentos where id = new.orcamento_id for update;
    if not found then
      raise exception 'Orçamento não encontrado.' using errcode = 'P0001';
    end if;
    if o.status <> 'aprovado' then
      raise exception 'Só orçamento aprovado recebe recibo (o nº % está %).', lpad(o.numero::text, 4, '0'), o.status using errcode = 'P0001';
    end if;
    select coalesce(sum(valor_centavos), 0) into v_pago from public.recibos where orcamento_id = o.id and status = 'emitido';
    v_saldo := o.total_centavos - v_pago;
    if new.valor_centavos > v_saldo then
      raise exception 'Valor maior que o saldo do orçamento nº % (saldo: %).', lpad(o.numero::text, 4, '0'), public.reais(v_saldo) using errcode = 'P0001';
    end if;
    if new.tipo = 'quitacao' and new.valor_centavos <> v_saldo then
      raise exception 'Quitação é o saldo inteiro do orçamento (%).', public.reais(v_saldo) using errcode = 'P0001';
    end if;
    new.orcamento_numero := o.numero;
    new.cliente_id := o.cliente_id;
  else
    new.orcamento_numero := null;
  end if;

  update public.numeracao set proximo = proximo + 1 where tipo = 'recibo' returning proximo - 1 into new.numero;
  if new.numero is null then
    raise exception 'Numeração de recibos não configurada.' using errcode = 'P0001';
  end if;
  new.emitido_por := auth.uid();
  new.criado_em := now();
  return new;
end;
$$;

create trigger recibos_emite before insert on public.recibos
  for each row execute function public.emite_recibo();

-- Depois de emitido, só o cancelamento (com motivo) muda o recibo.
create function public.valida_recibo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'cancelado' then
    raise exception 'Recibo cancelado não muda.' using errcode = 'P0001';
  end if;
  if new.status <> 'cancelado'
     or (to_jsonb(new) - array['status', 'motivo_cancelamento', 'cancelado_em', 'cancelado_por'])
        is distinct from (to_jsonb(old) - array['status', 'motivo_cancelamento', 'cancelado_em', 'cancelado_por']) then
    raise exception 'Recibo emitido não muda: cancele e emita outro.' using errcode = 'P0001';
  end if;
  if length(trim(new.motivo_cancelamento)) < 3 then
    raise exception 'Escreva o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  new.cancelado_em := now();
  new.cancelado_por := auth.uid();
  return new;
end;
$$;

create trigger recibos_valida before update on public.recibos
  for each row execute function public.valida_recibo();

-- Orçamento com recibo emitido não deixa de ser aprovado (o dinheiro já entrou).
create function public.trava_orcamento_com_recibo()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if old.status = 'aprovado' and new.status <> 'aprovado'
     and exists (select 1 from public.recibos r where r.orcamento_id = old.id and r.status = 'emitido') then
    raise exception 'O orçamento nº % tem recibo emitido: cancele os recibos antes de desfazer a aprovação.', lpad(old.numero::text, 4, '0')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger orcamentos_com_recibo before update on public.orcamentos
  for each row execute function public.trava_orcamento_com_recibo();

-- Próximo número: agora também de recibos (para continuar a numeração do talão).
create or replace function public.definir_proximo_numero(p_tipo text, p_proximo integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_maior integer;
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora muda a numeração.' using errcode = '42501';
  end if;
  if p_tipo = 'orcamento' then
    select max(numero) into v_maior from public.orcamentos;
  elsif p_tipo = 'recibo' then
    select max(numero) into v_maior from public.recibos;
  else
    raise exception 'Numeração desconhecida.' using errcode = 'P0001';
  end if;
  if p_proximo <= coalesce(v_maior, 0) then
    raise exception 'O próximo número precisa ser maior que %, o último usado.', lpad(v_maior::text, 4, '0') using errcode = 'P0001';
  end if;
  update public.numeracao set proximo = p_proximo where tipo = p_tipo;
end;
$$;

-- ---------------------------------------------------------------------
-- Saldo dos orçamentos aprovados (o RLS do orçamento vale: security_invoker).
-- ---------------------------------------------------------------------
create view public.saldos_orcamentos with (security_invoker = true) as
select o.id as orcamento_id,
       o.numero,
       o.cliente_id,
       o.total_centavos,
       coalesce(sum(r.valor_centavos) filter (where r.status = 'emitido'), 0)::integer as pago_centavos,
       (o.total_centavos - coalesce(sum(r.valor_centavos) filter (where r.status = 'emitido'), 0))::integer as saldo_centavos
  from public.orcamentos o
  left join public.recibos r on r.orcamento_id = o.id
 where o.status = 'aprovado'
 group by o.id;

-- ---------------------------------------------------------------------
-- RLS: gestora emite e cancela; contador lê; funcionária nada.
-- ---------------------------------------------------------------------
alter table public.recibos enable row level security;

create policy recibos_le on public.recibos for select to authenticated
  using ((select public.papel_atual()) in ('gestora', 'contador'));
create policy recibos_gestora_emite on public.recibos for insert to authenticated
  with check ((select public.eh_gestora()));
create policy recibos_gestora_cancela on public.recibos for update to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

revoke truncate, references, trigger on public.recibos from anon, authenticated;
grant select, insert, update on public.recibos to authenticated;
grant select on public.saldos_orcamentos to authenticated;
grant select, insert, update, delete on public.recibos to service_role;
grant select on public.saldos_orcamentos to service_role;

revoke execute on function public.emite_recibo(), public.valida_recibo(), public.trava_orcamento_com_recibo() from public, anon;

revoke execute on function public.reais(integer) from public, anon;
grant execute on function public.reais(integer) to authenticated, service_role;
