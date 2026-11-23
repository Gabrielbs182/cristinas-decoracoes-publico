-- =====================================================================
-- 0.8 — Orçamentos. Só a gestora mexe (RLS). A cliente vê e aprova pelo link (token), por funções
-- SECURITY DEFINER que devolvem só o que vai no orçamento — é a única porta do anon no banco.
-- Dinheiro em centavos, medidas em centímetros. Numeração sem buraco: contador em tabela, travado na
-- transação (sequence pularia número em transação desfeita). Orçamento não se apaga: rascunho
-- descartado fica "cancelado".
-- =====================================================================

create type public.status_orcamento as enum ('rascunho', 'enviado', 'aprovado', 'recusado', 'cancelado');
create type public.tipo_item_orcamento as enum ('cortina', 'persiana', 'trilho', 'acessorio', 'servico');

-- Padrões do orçamento novo (junto das regras de cálculo).
alter table public.regras_orcamento
  add column validade_padrao_dias integer not null default 30 check (validade_padrao_dias between 1 and 365),
  add column prazo_entrega_padrao text not null default '20 dias úteis após o sinal' check (length(prazo_entrega_padrao) <= 120),
  add column condicoes_padrao text not null default '50% de sinal e 50% na instalação' check (length(condicoes_padrao) <= 200);

-- ---------------------------------------------------------------------
-- Numeração (orçamento agora; recibo na 0.9).
-- ---------------------------------------------------------------------
create table public.numeracao (
  tipo text primary key check (tipo in ('orcamento', 'recibo')),
  proximo integer not null check (proximo between 1 and 999999)
);

insert into public.numeracao (tipo, proximo) values ('orcamento', 1), ('recibo', 1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- Orçamento, ambientes e itens.
-- ---------------------------------------------------------------------
create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  status public.status_orcamento not null default 'rascunho',
  endereco_obra text not null default '' check (length(endereco_obra) <= 300),
  validade_dias integer not null default 30 check (validade_dias between 1 and 365),
  prazo_entrega text not null default '' check (length(prazo_entrega) <= 120),
  condicoes_pagamento text not null default '' check (length(condicoes_pagamento) <= 200),
  -- Desconto: em centésimos de ponto percentual (500 = 5%) ou em centavos.
  desconto_modo text not null default 'pct' check (desconto_modo in ('pct', 'brl')),
  desconto_valor integer not null default 0 check (desconto_valor >= 0),
  deslocamento_centavos integer not null default 0 check (deslocamento_centavos between 0 and 10000000),
  subtotal_centavos integer not null default 0 check (subtotal_centavos >= 0),
  desconto_centavos integer not null default 0 check (desconto_centavos >= 0),
  total_centavos integer not null default 0 check (total_centavos >= 0),
  obs_cliente text not null default '' check (length(obs_cliente) <= 2000),
  obs_interna text not null default '' check (length(obs_interna) <= 2000),
  -- Link da cliente: aleatório (122 bits), nunca o id nem o número.
  token uuid not null unique default gen_random_uuid(),
  enviado_em timestamptz,
  valido_ate date,
  respondido_em timestamptz,
  resposta_motivo text not null default '' check (length(resposta_motivo) <= 500),
  aprovado_pelo_link boolean not null default false,
  criado_por uuid references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint orcamento_desconto_pct check (desconto_modo <> 'pct' or desconto_valor <= 10000)
);

create index orcamentos_cliente on public.orcamentos (cliente_id);
create index orcamentos_status on public.orcamentos (status, criado_em desc);

create table public.orcamento_ambientes (
  id uuid primary key,
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  ordem integer not null,
  nome text not null check (length(trim(nome)) between 1 and 60)
);

create index orcamento_ambientes_orcamento on public.orcamento_ambientes (orcamento_id, ordem);

create table public.orcamento_itens (
  id uuid primary key,
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  ambiente_id uuid not null references public.orcamento_ambientes (id) on delete cascade,
  ordem integer not null,
  tipo public.tipo_item_orcamento not null,
  produto_id uuid references public.produtos (id),
  modelo_id uuid references public.modelos_confeccao (id),
  trilho_id uuid references public.produtos (id),
  motorizado boolean not null default false,
  motor_id uuid references public.produtos (id),
  instalacao_id uuid references public.produtos (id),
  cor text not null default '' check (length(cor) <= 60),
  largura_cm integer check (largura_cm between 1 and 5000),
  altura_cm integer check (altura_cm between 1 and 1000),
  quantidade integer not null default 1 check (quantidade between 1 and 999),
  -- Preços e regras usados no cálculo, congelados no item (o catálogo pode mudar depois).
  precos jsonb not null,
  -- Memória de cálculo exatamente como foi mostrada: [{rotulo, memoria, valor_centavos}].
  linhas jsonb not null,
  descricao text not null check (length(descricao) <= 300),
  medidas text not null default '' check (length(medidas) <= 60),
  unitario_centavos integer not null check (unitario_centavos >= 0),
  total_centavos integer not null check (total_centavos >= 0)
);

create index orcamento_itens_orcamento on public.orcamento_itens (orcamento_id, ordem);

create trigger orcamentos_atualizado_em before update on public.orcamentos
  for each row execute function public.toca_atualizado_em();

-- ---------------------------------------------------------------------
-- Número sem buraco: o contador é travado e incrementado na mesma transação do INSERT.
-- ---------------------------------------------------------------------
create function public.numera_orcamento()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.numeracao set proximo = proximo + 1 where tipo = 'orcamento' returning proximo - 1 into new.numero;
  if new.numero is null then
    raise exception 'Numeração de orçamentos não configurada.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger orcamentos_numero before insert on public.orcamentos
  for each row execute function public.numera_orcamento();

-- ---------------------------------------------------------------------
-- Situação: só as transições do fluxo; fora do rascunho, só a observação interna muda.
-- ---------------------------------------------------------------------
create function public.valida_orcamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  controle text[] := array['status', 'enviado_em', 'valido_ate', 'respondido_em', 'resposta_motivo', 'aprovado_pelo_link', 'obs_interna', 'atualizado_em'];
begin
  if (new.numero, new.token, new.criado_por, new.criado_em) is distinct from (old.numero, old.token, old.criado_por, old.criado_em) then
    raise exception 'Número, link e autoria do orçamento não mudam.' using errcode = 'P0001';
  end if;

  -- Fora do rascunho o conteúdo (cliente, itens, valores, condições) não muda, nem junto com a troca de
  -- situação: só os campos de controle da situação e a observação interna.
  if old.status <> 'rascunho' then
    if new.status = old.status then
      if (to_jsonb(new) - array['obs_interna', 'atualizado_em']) is distinct from (to_jsonb(old) - array['obs_interna', 'atualizado_em']) then
        raise exception 'Orçamento % não é mais rascunho: volte para rascunho para editar.', lpad(old.numero::text, 4, '0') using errcode = 'P0001';
      end if;
    elsif (to_jsonb(new) - controle) is distinct from (to_jsonb(old) - controle) then
      raise exception 'Ao mudar a situação, o conteúdo do orçamento não muda.' using errcode = 'P0001';
    end if;
  end if;
  if new.status = old.status then
    return new;
  end if;

  case
    when old.status = 'rascunho' and new.status = 'enviado' then
      if new.total_centavos <= 0 or not exists (select 1 from public.orcamento_itens i where i.orcamento_id = new.id) then
        raise exception 'Orçamento sem itens ou com total zero não pode ser enviado.' using errcode = 'P0001';
      end if;
      new.enviado_em := now();
      new.valido_ate := hoje + new.validade_dias;
    when old.status = 'rascunho' and new.status = 'cancelado' then
      null;
    when old.status = 'enviado' and new.status in ('aprovado', 'recusado') then
      new.respondido_em := now();
    when old.status = 'aprovado' and new.status = 'enviado' then
      -- Desfazer uma aprovação marcada por engano (na 0.9, recibo emitido vai impedir).
      new.respondido_em := null;
      new.aprovado_pelo_link := false;
    when old.status in ('enviado', 'recusado') and new.status = 'rascunho' then
      new.enviado_em := null;
      new.valido_ate := null;
      new.respondido_em := null;
      new.resposta_motivo := '';
      new.aprovado_pelo_link := false;
    else
      raise exception 'Mudança de situação não permitida: % → %.', old.status, new.status using errcode = 'P0001';
  end case;
  return new;
end;
$$;

create trigger orcamentos_valida before update on public.orcamentos
  for each row execute function public.valida_orcamento();

-- Ambientes e itens só mudam com o orçamento em rascunho (preço enviado ao cliente não muda).
create function public.trava_itens_orcamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.status_orcamento;
begin
  select status into v_status from public.orcamentos
   where id = case when tg_op = 'DELETE' then old.orcamento_id else new.orcamento_id end;
  -- Sem orçamento = exclusão em cascata do próprio orçamento (não acontece pela API).
  if v_status is not null and v_status <> 'rascunho' then
    raise exception 'Orçamento enviado não muda: volte para rascunho para editar.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger orcamento_ambientes_trava before insert or update or delete on public.orcamento_ambientes
  for each row execute function public.trava_itens_orcamento();
create trigger orcamento_itens_trava before insert or update or delete on public.orcamento_itens
  for each row execute function public.trava_itens_orcamento();

-- ---------------------------------------------------------------------
-- Salvar o rascunho de uma vez: cabeçalho + ambientes + itens (tudo ou nada). O servidor calcula
-- (lib/vendas/orcamento.ts) e manda as linhas prontas, como no fechamento da semana.
-- ---------------------------------------------------------------------
create function public.salvar_orcamento(p_id uuid, p_cabecalho jsonb, p_ambientes jsonb, p_itens jsonb)
returns timestamptz
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_status public.status_orcamento;
  v_quando timestamptz;
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora edita orçamentos.' using errcode = '42501';
  end if;
  select status into v_status from public.orcamentos where id = p_id for update;
  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0001';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'Orçamento enviado não muda: volte para rascunho para editar.' using errcode = 'P0001';
  end if;

  update public.orcamentos set
    cliente_id = (p_cabecalho ->> 'cliente_id')::uuid,
    endereco_obra = p_cabecalho ->> 'endereco_obra',
    validade_dias = (p_cabecalho ->> 'validade_dias')::integer,
    prazo_entrega = p_cabecalho ->> 'prazo_entrega',
    condicoes_pagamento = p_cabecalho ->> 'condicoes_pagamento',
    desconto_modo = p_cabecalho ->> 'desconto_modo',
    desconto_valor = (p_cabecalho ->> 'desconto_valor')::integer,
    deslocamento_centavos = (p_cabecalho ->> 'deslocamento_centavos')::integer,
    subtotal_centavos = (p_cabecalho ->> 'subtotal_centavos')::integer,
    desconto_centavos = (p_cabecalho ->> 'desconto_centavos')::integer,
    total_centavos = (p_cabecalho ->> 'total_centavos')::integer,
    obs_cliente = p_cabecalho ->> 'obs_cliente',
    obs_interna = p_cabecalho ->> 'obs_interna'
  where id = p_id
  returning atualizado_em into v_quando;

  delete from public.orcamento_ambientes where orcamento_id = p_id;  -- itens vão em cascata

  insert into public.orcamento_ambientes (id, orcamento_id, ordem, nome)
  select a.id, p_id, a.ordem, a.nome
    from jsonb_to_recordset(p_ambientes) as a(id uuid, ordem integer, nome text);

  insert into public.orcamento_itens (
    id, orcamento_id, ambiente_id, ordem, tipo, produto_id, modelo_id, trilho_id, motorizado, motor_id, instalacao_id,
    cor, largura_cm, altura_cm, quantidade, precos, linhas, descricao, medidas, unitario_centavos, total_centavos
  )
  select i.id, p_id, i.ambiente_id, i.ordem, i.tipo, i.produto_id, i.modelo_id, i.trilho_id, i.motorizado, i.motor_id, i.instalacao_id,
         i.cor, i.largura_cm, i.altura_cm, i.quantidade, i.precos, i.linhas, i.descricao, i.medidas, i.unitario_centavos, i.total_centavos
    from jsonb_to_recordset(p_itens) as i(
      id uuid, ambiente_id uuid, ordem integer, tipo public.tipo_item_orcamento, produto_id uuid, modelo_id uuid, trilho_id uuid,
      motorizado boolean, motor_id uuid, instalacao_id uuid, cor text, largura_cm integer, altura_cm integer, quantidade integer,
      precos jsonb, linhas jsonb, descricao text, medidas text, unitario_centavos integer, total_centavos integer
    );
  return v_quando;
end;
$$;

-- Próximo número (para continuar a numeração que a loja já usa). Só para frente.
create function public.definir_proximo_numero(p_tipo text, p_proximo integer)
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
-- Documento do orçamento (o que vai no PDF e na página da cliente). Sem observação interna.
-- ---------------------------------------------------------------------
create function public.montar_documento_orcamento(p_id uuid)
returns jsonb
language sql
stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'numero', o.numero,
    'status', o.status,
    'vencido', o.status = 'enviado' and o.valido_ate < (now() at time zone 'America/Sao_Paulo')::date,
    'criado_em', o.criado_em,
    'enviado_em', o.enviado_em,
    'valido_ate', o.valido_ate,
    'validade_dias', o.validade_dias,
    'respondido_em', o.respondido_em,
    'aprovado_pelo_link', o.aprovado_pelo_link,
    'cliente', jsonb_build_object('nome', c.nome, 'telefone', c.telefone),
    'endereco_obra', o.endereco_obra,
    'prazo_entrega', o.prazo_entrega,
    'condicoes_pagamento', o.condicoes_pagamento,
    'obs_cliente', o.obs_cliente,
    'subtotal_centavos', o.subtotal_centavos,
    'desconto_centavos', o.desconto_centavos,
    'deslocamento_centavos', o.deslocamento_centavos,
    'total_centavos', o.total_centavos,
    'vendedora', coalesce(p.nome, ''),
    'empresa', (select jsonb_build_object('nome', e.nome_fantasia, 'razao_social', e.razao_social, 'cnpj', e.cnpj, 'telefone', e.telefone,
                                          'email', e.email, 'endereco', e.endereco, 'cidade_uf', e.cidade_uf)
                  from public.empresa e limit 1),
    'ambientes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nome', a.nome,
               'itens', coalesce((
                 select jsonb_agg(jsonb_build_object('descricao', i.descricao, 'medidas', i.medidas, 'quantidade', i.quantidade,
                                                     'unitario_centavos', i.unitario_centavos, 'total_centavos', i.total_centavos)
                                  order by i.ordem)
                   from public.orcamento_itens i where i.ambiente_id = a.id), '[]'::jsonb)
             ) order by a.ordem)
        from public.orcamento_ambientes a where a.orcamento_id = o.id), '[]'::jsonb)
  )
  from public.orcamentos o
  join public.clientes c on c.id = o.cliente_id
  left join public.perfis p on p.id = o.criado_por
  where o.id = p_id
$$;

revoke execute on function public.montar_documento_orcamento(uuid) from public, anon, authenticated;

-- Gestora: qualquer orçamento.
create function public.documento_orcamento(p_id uuid)
returns jsonb
language plpgsql
stable security definer set search_path = ''
as $$
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora vê orçamentos.' using errcode = '42501';
  end if;
  return public.montar_documento_orcamento(p_id);
end;
$$;

-- Cliente, pelo link: só depois de enviado (rascunho e cancelado não existem para ela).
create function public.orcamento_publico(p_token uuid)
returns jsonb
language sql
stable security definer set search_path = ''
as $$
  select public.montar_documento_orcamento(o.id)
    from public.orcamentos o
   where o.token = p_token and o.status in ('enviado', 'aprovado', 'recusado')
$$;

create function public.aprovar_orcamento_publico(p_token uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  o public.orcamentos;
begin
  select * into o from public.orcamentos where token = p_token for update;
  if not found or o.status not in ('enviado', 'aprovado', 'recusado') then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0001';
  end if;
  if o.status = 'aprovado' then
    return o.numero;  -- dois toques no botão: continua aprovado
  end if;
  if o.status <> 'enviado' then
    raise exception 'Este orçamento não está mais aberto para aprovação. Fale com a loja.' using errcode = 'P0001';
  end if;
  if o.valido_ate < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Este orçamento venceu em %. Fale com a loja para renovar.', to_char(o.valido_ate, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  update public.orcamentos set status = 'aprovado', aprovado_pelo_link = true where id = o.id;
  return o.numero;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS e privilégios: só a gestora. O anon só executa as duas funções do link.
-- ---------------------------------------------------------------------
alter table public.numeracao enable row level security;
alter table public.orcamentos enable row level security;
alter table public.orcamento_ambientes enable row level security;
alter table public.orcamento_itens enable row level security;

create policy numeracao_gestora_le on public.numeracao for select to authenticated using ((select public.eh_gestora()));
create policy orcamentos_gestora on public.orcamentos for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));
create policy orcamento_ambientes_gestora on public.orcamento_ambientes for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));
create policy orcamento_itens_gestora on public.orcamento_itens for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

revoke truncate, references, trigger on public.numeracao, public.orcamentos, public.orcamento_ambientes, public.orcamento_itens from anon, authenticated;
grant select on public.numeracao to authenticated;
grant select, insert, update on public.orcamentos to authenticated;
grant select, insert, update, delete on public.orcamento_ambientes, public.orcamento_itens to authenticated;
grant select, insert, update, delete on public.numeracao, public.orcamentos, public.orcamento_ambientes, public.orcamento_itens to service_role;

revoke execute on function public.numera_orcamento(), public.valida_orcamento(), public.trava_itens_orcamento() from public, anon;
revoke execute on function public.salvar_orcamento(uuid, jsonb, jsonb, jsonb), public.definir_proximo_numero(text, integer), public.documento_orcamento(uuid)
  from public, anon;
grant execute on function public.salvar_orcamento(uuid, jsonb, jsonb, jsonb), public.definir_proximo_numero(text, integer), public.documento_orcamento(uuid)
  to authenticated;
revoke execute on function public.orcamento_publico(uuid), public.aprovar_orcamento_publico(uuid) from public;
grant execute on function public.orcamento_publico(uuid), public.aprovar_orcamento_publico(uuid) to anon, authenticated;
