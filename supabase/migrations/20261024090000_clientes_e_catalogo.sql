-- =====================================================================
-- 0.7 — Clientes e catálogo (base dos orçamentos). Só a gestora vê e mexe: são dados de clientes
-- (CPF, telefone, endereço) e a tabela de preços da empresa.
-- Dinheiro em CENTAVOS (integer) e medidas em CENTÍMETROS (área em cm²): nada de ponto flutuante.
-- =====================================================================

create type public.categoria_produto as enum ('tecido', 'persiana', 'trilho', 'acessorio', 'servico');
create type public.unidade_produto as enum ('m', 'm2', 'un', 'vao');

create function public.toca_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Clientes. Obra vazia = a obra é na residência.
-- ---------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 120),
  telefone text not null default '' check (length(telefone) <= 30),
  email text not null default '' check (length(email) <= 120),
  -- Só dígitos: CPF (11) ou CNPJ (14).
  documento text not null default '' check (documento = '' or documento ~ '^([0-9]{11}|[0-9]{14})$'),
  residencia_endereco text not null default '' check (length(residencia_endereco) <= 200),
  residencia_bairro text not null default '' check (length(residencia_bairro) <= 80),
  residencia_cidade text not null default '' check (length(residencia_cidade) <= 80),
  obra_endereco text not null default '' check (length(obra_endereco) <= 200),
  obra_bairro text not null default '' check (length(obra_bairro) <= 80),
  obra_cidade text not null default '' check (length(obra_cidade) <= 80),
  observacoes text not null default '' check (length(observacoes) <= 1000),
  criado_por uuid references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index clientes_nome on public.clientes (lower(nome));
create trigger clientes_atualizado_em before update on public.clientes
  for each row execute function public.toca_atualizado_em();

-- ---------------------------------------------------------------------
-- Catálogo. A unidade segue a categoria (é ela que diz como o orçamento calcula).
-- Produto não se apaga (orçamentos antigos apontam para ele): inativa.
-- ---------------------------------------------------------------------
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  categoria public.categoria_produto not null,
  nome text not null check (length(trim(nome)) between 2 and 120),
  unidade public.unidade_produto not null,
  preco_centavos integer not null check (preco_centavos between 0 and 100000000),
  largura_rolo_cm integer check (largura_rolo_cm between 50 and 600),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint produto_unidade_da_categoria check (
    (categoria = 'tecido' and unidade = 'm')
    or (categoria = 'persiana' and unidade = 'm2')
    or (categoria = 'trilho' and unidade = 'm')
    or (categoria = 'acessorio' and unidade = 'un')
    or (categoria = 'servico' and unidade in ('vao', 'un'))
  ),
  constraint produto_rolo_so_tecido check (largura_rolo_cm is null or categoria = 'tecido')
);

create unique index produtos_nome_unico on public.produtos (categoria, lower(trim(nome)));
create trigger produtos_atualizado_em before update on public.produtos
  for each row execute function public.toca_atualizado_em();

-- Confecção da cortina: o fator de franzimento multiplica a largura do vão (metros de tecido) e a
-- confecção é cobrada por metro de tecido.
create table public.modelos_confeccao (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 60),
  fator_franzimento numeric(3, 2) not null check (fator_franzimento between 1 and 4),
  preco_metro_centavos integer not null check (preco_metro_centavos between 0 and 10000000),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index modelos_confeccao_nome_unico on public.modelos_confeccao (lower(trim(nome)));
create trigger modelos_confeccao_atualizado_em before update on public.modelos_confeccao
  for each row execute function public.toca_atualizado_em();

-- Regras gerais de cálculo (linha única, como a empresa).
create table public.regras_orcamento (
  id boolean primary key default true check (id),
  sobra_trilho_cm integer not null default 20 check (sobra_trilho_cm between 0 and 100),
  area_minima_persiana_cm2 integer not null default 15000 check (area_minima_persiana_cm2 between 0 and 100000),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) default auth.uid()
);

insert into public.regras_orcamento (id) values (true) on conflict do nothing;

-- Nas regras importa quem mudou, além de quando.
create function public.toca_regras_orcamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

create trigger regras_orcamento_atualizado_em before update on public.regras_orcamento
  for each row execute function public.toca_regras_orcamento();

-- ---------------------------------------------------------------------
-- RLS: só a gestora. Contador e funcionária não veem nada daqui.
-- ---------------------------------------------------------------------
alter table public.clientes enable row level security;
alter table public.produtos enable row level security;
alter table public.modelos_confeccao enable row level security;
alter table public.regras_orcamento enable row level security;

create policy clientes_gestora on public.clientes for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));
create policy produtos_gestora on public.produtos for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));
create policy modelos_confeccao_gestora on public.modelos_confeccao for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));
create policy regras_orcamento_gestora_le on public.regras_orcamento for select to authenticated
  using ((select public.eh_gestora()));
create policy regras_orcamento_gestora_altera on public.regras_orcamento for update to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

revoke truncate, references, trigger on public.clientes, public.produtos, public.modelos_confeccao, public.regras_orcamento from anon, authenticated;
grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update on public.produtos to authenticated;
grant select, insert, update on public.modelos_confeccao to authenticated;
grant select, update on public.regras_orcamento to authenticated;
grant select, insert, update, delete on public.clientes, public.produtos, public.modelos_confeccao, public.regras_orcamento to service_role;
revoke execute on function public.toca_atualizado_em(), public.toca_regras_orcamento() from public, anon;
