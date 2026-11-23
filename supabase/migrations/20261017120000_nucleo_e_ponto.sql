-- =====================================================================
-- Núcleo (perfis, empresa) e módulo de Ponto/RH.
--
-- Princípios:
--   * Batida da catraca é imutável. Toda correção é um lançamento novo no
--     diário `ponto_lancamentos`, que só aceita INSERT. O histórico do dia
--     é o próprio diário.
--   * Semana fechada fica travada no banco (trigger), não só na tela.
--   * Acesso por papel via RLS: gestora vê tudo; funcionária só as próprias
--     linhas; contador só lê o que é relatório.
--   * Horários guardados como segundos desde 00:00 (hora local da catraca,
--     sem fuso), igual ao arquivo de origem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.papel as enum ('gestora', 'funcionaria', 'contador');

-- E = entrada, A = saída para almoço, V = volta do almoço, S = saída
create type public.tipo_batida as enum ('E', 'A', 'V', 'S');

create type public.tipo_ocorrencia as enum ('atestado', 'falta_justificada', 'folga', 'feriado', 'falta');

create type public.tipo_lancamento as enum (
  'adicionar_batida',
  'alterar_horario',
  'desconsiderar_batida',
  'trocar_tipo',
  'ocorrencia',
  'resolver_pendencia',
  'cancelar'
);

create type public.status_solicitacao as enum ('pendente', 'aprovada', 'recusada');

create type public.status_semana as enum ('aberta', 'fechada');

-- ---------------------------------------------------------------------
-- Funcionárias e perfis de acesso
-- ---------------------------------------------------------------------
create table public.funcionarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  nome_exibicao text not null check (length(trim(nome_exibicao)) > 0),
  -- EnNo da catraca, 9 dígitos com zeros à esquerda. Nulo até ser vinculado.
  en_no text unique check (en_no ~ '^[0-9]{9}$'),
  ativa boolean not null default true,
  -- Jornada própria; nulo = usa a regra geral.
  carga_seg_qui_min integer check (carga_seg_qui_min between 0 and 1440),
  carga_sex_min integer check (carga_sex_min between 0 and 1440),
  criado_em timestamptz not null default now()
);

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel public.papel not null,
  funcionaria_id uuid unique references public.funcionarias (id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  -- Perfil de funcionária sempre aponta para o cadastro dela; os outros nunca.
  constraint perfis_funcionaria_coerente check ((papel = 'funcionaria') = (funcionaria_id is not null))
);

-- Funções de contexto usadas pelas policies. SECURITY DEFINER para ler
-- `perfis` sem recursão de RLS; search_path vazio contra sequestro de nomes.
create function public.papel_atual()
returns public.papel
language sql stable security definer set search_path = ''
as $$
  select p.papel from public.perfis p where p.id = auth.uid() and p.ativo
$$;

create function public.funcionaria_atual()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.funcionaria_id from public.perfis p
  where p.id = auth.uid() and p.ativo and p.papel = 'funcionaria'
$$;

create function public.eh_gestora()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.papel_atual() = 'gestora', false)
$$;

create function public.tem_perfil()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.papel_atual() is not null
$$;

-- ---------------------------------------------------------------------
-- Empresa (linha única; dados usados nos PDFs)
-- ---------------------------------------------------------------------
create table public.empresa (
  id boolean primary key default true check (id),
  razao_social text not null default '',
  nome_fantasia text not null default 'Cristina''s Decorações',
  cnpj text not null default '',
  endereco text not null default '',
  cidade_uf text not null default '',
  telefone text not null default '',
  email text not null default '',
  chave_pix text not null default '',
  logo_path text
);

-- ---------------------------------------------------------------------
-- Regras de jornada (versionadas por vigência; nunca editadas no lugar)
-- ---------------------------------------------------------------------
create table public.regras_ponto (
  id bigint generated always as identity primary key,
  vigente_desde date not null unique check (extract(isodow from vigente_desde) = 1),
  carga_seg_qui_min integer not null default 540 check (carga_seg_qui_min between 0 and 1440),
  carga_sex_min integer not null default 480 check (carga_sex_min between 0 and 1440),
  entrada_prevista_min integer not null default 420 check (entrada_prevista_min between 0 and 1439),
  almoco_inicio_previsto_min integer not null default 720 check (almoco_inicio_previsto_min between 0 and 1439),
  almoco_padrao_min integer not null default 60 check (almoco_padrao_min between 0 and 240),
  hora_corte_min integer not null default 480 check (hora_corte_min > 0),
  tolerancia_corte_min integer not null default 10 check (tolerancia_corte_min >= 0),
  tolerancia_atraso_min integer not null default 10 check (tolerancia_atraso_min >= 0),
  janela_duplicada_min integer not null default 5 check (janela_duplicada_min between 0 and 60),
  criado_por uuid references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now()
);

create table public.feriados (
  data date primary key,
  nome text not null check (length(trim(nome)) > 0),
  tipo text not null check (tipo in ('nacional', 'municipal', 'ponte', 'facultativo'))
);

-- ---------------------------------------------------------------------
-- Semanas (segunda-feira como chave)
-- ---------------------------------------------------------------------
create table public.semanas (
  segunda date primary key check (extract(isodow from segunda) = 1),
  status public.status_semana not null default 'aberta',
  fechada_em timestamptz,
  fechada_por uuid references auth.users (id),
  regras jsonb
);

create function public.segunda_de(d date)
returns date
language sql immutable
as $$
  select d - (extract(isodow from d)::integer - 1)
$$;

create function public.semana_fechada(d date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.semanas s
    where s.segunda = public.segunda_de(d) and s.status = 'fechada'
  )
$$;

create table public.semana_eventos (
  id bigint generated always as identity primary key,
  segunda date not null references public.semanas (segunda),
  acao text not null check (acao in ('fechar', 'reabrir')),
  motivo text,
  autor uuid not null references auth.users (id) default auth.uid(),
  em timestamptz not null default now(),
  check (acao = 'fechar' or length(trim(coalesce(motivo, ''))) > 0)
);

-- Fotografia do fechamento: o que vale para relatório, espelho e contador.
create table public.semana_resultados (
  segunda date not null references public.semanas (segunda) on delete cascade,
  funcionaria_id uuid not null references public.funcionarias (id),
  saldo_anterior_min integer not null,
  extras_semana_min integer not null,
  ajustes_min integer not null default 0,
  acumulado_min integer not null,
  fechou_corte boolean not null,
  proxima_semana_min integer not null,
  trabalhadas_min integer not null,
  dias_trabalhados integer not null,
  espelho_path text,
  primary key (segunda, funcionaria_id)
);

create table public.semana_resultado_dias (
  segunda date not null,
  funcionaria_id uuid not null,
  data date not null,
  entrada text,
  saida_almoco text,
  volta_almoco text,
  saida text,
  trabalhadas_min integer,
  extra_min integer not null default 0,
  situacao text not null,
  ajustado boolean not null default false,
  primary key (funcionaria_id, data),
  foreign key (segunda, funcionaria_id) references public.semana_resultados (segunda, funcionaria_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Importações e batidas da catraca
-- ---------------------------------------------------------------------
create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  arquivo_sha256 text not null,
  periodo_inicio date,
  periodo_fim date,
  linhas_lidas integer not null,
  batidas_novas integer not null,
  batidas_repetidas integer not null,
  batidas_semana_fechada integer not null default 0,
  linhas_com_erro jsonb not null default '[]'::jsonb,
  importado_por uuid not null references auth.users (id) default auth.uid(),
  importado_em timestamptz not null default now()
);

create table public.batidas (
  id bigint generated always as identity primary key,
  en_no text not null check (en_no ~ '^[0-9]{9}$'),
  -- Resolvido na importação pelo EnNo; nulo = ID desconhecido (vira pendência).
  funcionaria_id uuid references public.funcionarias (id),
  data date not null,
  hora_seg integer not null check (hora_seg between 0 and 86399),
  -- Código de tipo da catraca. Pouco confiável (ver docs); só para exibição.
  iomd smallint,
  importacao_id uuid references public.importacoes (id),
  criado_em timestamptz not null default now(),
  unique (en_no, data, hora_seg)
);

create index batidas_funcionaria_data on public.batidas (funcionaria_id, data);
create index batidas_data on public.batidas (data);

-- ID da catraca que não é de ninguém (ex.: cadastro de teste no relógio). As batidas
-- continuam guardadas; só deixam de virar pendência.
create table public.catraca_ids_ignorados (
  en_no text primary key check (en_no ~ '^[0-9]{9}$'),
  motivo text not null check (length(trim(motivo)) > 0),
  autor uuid not null references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Diário de lançamentos do ponto (append-only)
-- ---------------------------------------------------------------------
create table public.ponto_lancamentos (
  id bigint generated always as identity primary key,
  funcionaria_id uuid not null references public.funcionarias (id),
  data date not null,
  tipo public.tipo_lancamento not null,
  -- Alvo: batida da catraca OU batida adicionada manualmente (o lançamento que a criou).
  batida_id bigint references public.batidas (id),
  lancamento_alvo_id bigint references public.ponto_lancamentos (id),
  hora_seg integer check (hora_seg between 0 and 86399),
  tipo_batida public.tipo_batida,
  ocorrencia public.tipo_ocorrencia,
  pendencia_codigo text,
  -- Estado do dia no momento da resolução; se o dia mudar, a pendência reabre.
  assinatura text,
  motivo text not null check (length(trim(motivo)) > 0),
  solicitacao_id bigint,
  autor uuid not null references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  constraint lancamento_campos check (
    case tipo
      when 'adicionar_batida' then hora_seg is not null and tipo_batida is not null
        and batida_id is null and lancamento_alvo_id is null
      when 'alterar_horario' then hora_seg is not null
        and ((batida_id is null) <> (lancamento_alvo_id is null))
      when 'desconsiderar_batida' then (batida_id is null) <> (lancamento_alvo_id is null)
      when 'trocar_tipo' then tipo_batida is not null
        and ((batida_id is null) <> (lancamento_alvo_id is null))
      when 'ocorrencia' then ocorrencia is not null
      when 'resolver_pendencia' then pendencia_codigo is not null and assinatura is not null
      when 'cancelar' then lancamento_alvo_id is not null and batida_id is null
    end
  )
);

create index ponto_lancamentos_funcionaria_data on public.ponto_lancamentos (funcionaria_id, data);

-- ---------------------------------------------------------------------
-- Solicitações de correção (vindas das funcionárias)
-- ---------------------------------------------------------------------
create table public.solicitacoes_correcao (
  id bigint generated always as identity primary key,
  funcionaria_id uuid not null references public.funcionarias (id),
  data date not null,
  tipo_batida public.tipo_batida,
  hora_seg integer check (hora_seg between 0 and 86399),
  ocorrencia public.tipo_ocorrencia,
  motivo text not null check (length(trim(motivo)) > 0),
  anexo_path text,
  status public.status_solicitacao not null default 'pendente',
  resposta text,
  respondida_por uuid references auth.users (id),
  respondida_em timestamptz,
  criada_por uuid not null references auth.users (id) default auth.uid(),
  criada_em timestamptz not null default now(),
  constraint solicitacao_pedido check (
    (tipo_batida is not null and hora_seg is not null and ocorrencia is null)
    or (ocorrencia is not null and tipo_batida is null and hora_seg is null)
  ),
  constraint solicitacao_recusa_tem_resposta check (
    status <> 'recusada' or length(trim(coalesce(resposta, ''))) > 0
  )
);

alter table public.ponto_lancamentos
  add constraint ponto_lancamentos_solicitacao_fk
  foreign key (solicitacao_id) references public.solicitacoes_correcao (id);

-- ---------------------------------------------------------------------
-- Ajustes manuais do banco de horas (append-only)
-- ---------------------------------------------------------------------
create table public.ajustes_saldo (
  id bigint generated always as identity primary key,
  funcionaria_id uuid not null references public.funcionarias (id),
  segunda date not null check (extract(isodow from segunda) = 1),
  minutos integer not null check (minutos <> 0),
  motivo text not null check (length(trim(motivo)) > 0),
  autor uuid not null references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now()
);

-- =====================================================================
-- Triggers de integridade
-- =====================================================================

-- Tabelas append-only: nada de UPDATE/DELETE, nem para o service role.
create function public.impede_alteracao()
returns trigger
language plpgsql
as $$
begin
  raise exception 'A tabela % só aceita inclusão. Para desfazer, registre um novo lançamento.', tg_table_name
    using errcode = 'P0001';
end;
$$;

create trigger ponto_lancamentos_append_only
  before update or delete on public.ponto_lancamentos
  for each row execute function public.impede_alteracao();

create trigger ajustes_saldo_append_only
  before update or delete on public.ajustes_saldo
  for each row execute function public.impede_alteracao();

create trigger semana_eventos_append_only
  before update or delete on public.semana_eventos
  for each row execute function public.impede_alteracao();

-- Batida da catraca: só pode ganhar o vínculo com a funcionária (de nulo para um valor).
create function public.batida_imutavel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Batida da catraca não pode ser apagada. Use "desconsiderar batida".'
      using errcode = 'P0001';
  end if;
  if (new.en_no, new.data, new.hora_seg, new.iomd, new.importacao_id)
       is distinct from (old.en_no, old.data, old.hora_seg, old.iomd, old.importacao_id)
     or (old.funcionaria_id is not null and new.funcionaria_id is distinct from old.funcionaria_id) then
    raise exception 'Batida da catraca é imutável; apenas o vínculo de um ID desconhecido pode ser feito.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger batidas_imutaveis
  before update or delete on public.batidas
  for each row execute function public.batida_imutavel();

-- Nada entra em semana fechada.
create function public.bloqueia_semana_fechada()
returns trigger
language plpgsql
as $$
declare
  d date;
begin
  -- IF em vez de CASE: o CASE resolveria new.segunda mesmo em tabelas sem essa coluna.
  if tg_table_name = 'ajustes_saldo' then
    d := new.segunda;
  else
    d := new.data;
  end if;
  if public.semana_fechada(d) then
    raise exception 'A semana de % está fechada. Reabra a semana para alterar.', to_char(public.segunda_de(d), 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger ponto_lancamentos_semana_aberta
  before insert on public.ponto_lancamentos
  for each row execute function public.bloqueia_semana_fechada();

create trigger ajustes_saldo_semana_aberta
  before insert on public.ajustes_saldo
  for each row execute function public.bloqueia_semana_fechada();

create trigger batidas_semana_aberta
  before insert on public.batidas
  for each row execute function public.bloqueia_semana_fechada();

-- Lançamento precisa apontar para algo do mesmo dia e da mesma funcionária.
create function public.valida_alvo_lancamento()
returns trigger
language plpgsql
as $$
declare
  alvo record;
begin
  if new.batida_id is not null then
    select funcionaria_id, data into alvo from public.batidas where id = new.batida_id;
    if alvo.funcionaria_id is distinct from new.funcionaria_id or alvo.data <> new.data then
      raise exception 'A batida % não é desta funcionária neste dia.', new.batida_id using errcode = 'P0001';
    end if;
  end if;
  if new.lancamento_alvo_id is not null then
    select funcionaria_id, data, tipo into alvo from public.ponto_lancamentos where id = new.lancamento_alvo_id;
    if alvo.funcionaria_id is distinct from new.funcionaria_id or alvo.data <> new.data then
      raise exception 'O lançamento % não é desta funcionária neste dia.', new.lancamento_alvo_id using errcode = 'P0001';
    end if;
    if new.tipo in ('alterar_horario', 'desconsiderar_batida', 'trocar_tipo') and alvo.tipo <> 'adicionar_batida' then
      raise exception 'Só é possível alterar uma batida adicionada manualmente.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger ponto_lancamentos_alvo
  before insert on public.ponto_lancamentos
  for each row execute function public.valida_alvo_lancamento();

-- Funcionária só cria pedido pendente, para si mesma; a resposta é da gestora.
create function public.valida_solicitacao()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pendente' or new.resposta is not null or new.respondida_por is not null then
      raise exception 'Solicitação nova precisa estar pendente e sem resposta.' using errcode = 'P0001';
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

create trigger solicitacoes_valida
  before insert or update on public.solicitacoes_correcao
  for each row execute function public.valida_solicitacao();

-- =====================================================================
-- Operações (RPC). SECURITY INVOKER: as policies continuam valendo.
-- =====================================================================

-- Vincula um EnNo desconhecido a uma funcionária e adota as batidas órfãs dele.
create function public.vincular_id_catraca(p_en_no text, p_funcionaria uuid)
returns integer
language plpgsql
security invoker set search_path = ''
as $$
declare
  atual text;
  adotadas integer;
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora pode vincular IDs da catraca.' using errcode = '42501';
  end if;
  select en_no into atual from public.funcionarias where id = p_funcionaria for update;
  if not found then
    raise exception 'Funcionária não encontrada.' using errcode = 'P0001';
  end if;
  if atual is not null and atual <> p_en_no then
    raise exception 'Esta funcionária já está vinculada ao ID %.', atual using errcode = 'P0001';
  end if;
  update public.funcionarias set en_no = p_en_no where id = p_funcionaria;
  update public.batidas set funcionaria_id = p_funcionaria
   where en_no = p_en_no and funcionaria_id is null;
  get diagnostics adotadas = row_count;
  return adotadas;
end;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.funcionarias enable row level security;
alter table public.perfis enable row level security;
alter table public.empresa enable row level security;
alter table public.regras_ponto enable row level security;
alter table public.feriados enable row level security;
alter table public.semanas enable row level security;
alter table public.semana_eventos enable row level security;
alter table public.semana_resultados enable row level security;
alter table public.semana_resultado_dias enable row level security;
alter table public.importacoes enable row level security;
alter table public.batidas enable row level security;
alter table public.ponto_lancamentos enable row level security;
alter table public.solicitacoes_correcao enable row level security;
alter table public.ajustes_saldo enable row level security;
alter table public.catraca_ids_ignorados enable row level security;

create policy ids_ignorados_gestora on public.catraca_ids_ignorados for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

-- perfis: cada um lê o próprio; a gestora lê e administra todos.
create policy perfis_le_proprio on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.eh_gestora()));
create policy perfis_gestora_altera on public.perfis for update to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

-- funcionarias: gestora administra; contador lê; funcionária lê só o próprio cadastro.
create policy funcionarias_le on public.funcionarias for select to authenticated
  using (
    (select public.papel_atual()) in ('gestora', 'contador')
    or id = (select public.funcionaria_atual())
  );
create policy funcionarias_gestora_inclui on public.funcionarias for insert to authenticated
  with check ((select public.eh_gestora()));
create policy funcionarias_gestora_altera on public.funcionarias for update to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

-- empresa: todos os perfis leem; gestora altera.
create policy empresa_le on public.empresa for select to authenticated
  using ((select public.tem_perfil()));
create policy empresa_gestora_altera on public.empresa for update to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

-- regras e feriados: todos os perfis leem; gestora cria.
create policy regras_le on public.regras_ponto for select to authenticated
  using ((select public.tem_perfil()));
create policy regras_gestora_inclui on public.regras_ponto for insert to authenticated
  with check ((select public.eh_gestora()));

create policy feriados_le on public.feriados for select to authenticated
  using ((select public.tem_perfil()));
create policy feriados_gestora_inclui on public.feriados for insert to authenticated
  with check ((select public.eh_gestora()));
create policy feriados_gestora_remove on public.feriados for delete to authenticated
  using ((select public.eh_gestora()));

-- semanas: todos os perfis leem o status; só a gestora abre/fecha.
create policy semanas_le on public.semanas for select to authenticated
  using ((select public.tem_perfil()));
create policy semanas_gestora_inclui on public.semanas for insert to authenticated
  with check ((select public.eh_gestora()));
create policy semanas_gestora_altera on public.semanas for update to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

create policy semana_eventos_le on public.semana_eventos for select to authenticated
  using ((select public.papel_atual()) in ('gestora', 'contador'));
create policy semana_eventos_gestora_inclui on public.semana_eventos for insert to authenticated
  with check ((select public.eh_gestora()));

-- resultados do fechamento: gestora e contador leem tudo; funcionária só os dela.
create policy semana_resultados_le on public.semana_resultados for select to authenticated
  using (
    (select public.papel_atual()) in ('gestora', 'contador')
    or funcionaria_id = (select public.funcionaria_atual())
  );
create policy semana_resultados_gestora_grava on public.semana_resultados for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

create policy semana_resultado_dias_le on public.semana_resultado_dias for select to authenticated
  using (
    (select public.papel_atual()) in ('gestora', 'contador')
    or funcionaria_id = (select public.funcionaria_atual())
  );
create policy semana_resultado_dias_gestora_grava on public.semana_resultado_dias for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

-- importações: só a gestora.
create policy importacoes_gestora on public.importacoes for all to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

-- batidas: gestora lê, importa e vincula; funcionária lê só as dela.
create policy batidas_le on public.batidas for select to authenticated
  using (
    (select public.eh_gestora())
    or funcionaria_id = (select public.funcionaria_atual())
  );
create policy batidas_gestora_inclui on public.batidas for insert to authenticated
  with check ((select public.eh_gestora()));
create policy batidas_gestora_vincula on public.batidas for update to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

-- diário: gestora lê e lança; funcionária lê o próprio (é o histórico do dia dela).
create policy lancamentos_le on public.ponto_lancamentos for select to authenticated
  using (
    (select public.eh_gestora())
    or funcionaria_id = (select public.funcionaria_atual())
  );
create policy lancamentos_gestora_inclui on public.ponto_lancamentos for insert to authenticated
  with check ((select public.eh_gestora()) and autor = (select auth.uid()));

-- solicitações: funcionária cria e lê as dela; gestora lê e responde.
create policy solicitacoes_le on public.solicitacoes_correcao for select to authenticated
  using (
    (select public.eh_gestora())
    or funcionaria_id = (select public.funcionaria_atual())
  );
create policy solicitacoes_funcionaria_cria on public.solicitacoes_correcao for insert to authenticated
  with check (
    funcionaria_id = (select public.funcionaria_atual())
    and criada_por = (select auth.uid())
  );
create policy solicitacoes_gestora_responde on public.solicitacoes_correcao for update to authenticated
  using ((select public.eh_gestora())) with check ((select public.eh_gestora()));

-- ajustes de saldo: gestora lança; contador lê; funcionária lê os dela.
create policy ajustes_le on public.ajustes_saldo for select to authenticated
  using (
    (select public.papel_atual()) in ('gestora', 'contador')
    or funcionaria_id = (select public.funcionaria_atual())
  );
create policy ajustes_gestora_inclui on public.ajustes_saldo for insert to authenticated
  with check ((select public.eh_gestora()) and autor = (select auth.uid()));

-- =====================================================================
-- Privilégios. O Supabase não concede mais nada por padrão em tabela nova
-- (só TRUNCATE/REFERENCES/TRIGGER). Concedemos só o que cada tabela usa;
-- o RLS filtra as linhas por cima disso.
-- =====================================================================

-- TRUNCATE ignora o RLS: ninguém da API pode ter.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

grant select, update on public.perfis to authenticated;
grant select, insert, update on public.funcionarias to authenticated;
grant select, update on public.empresa to authenticated;
grant select, insert on public.regras_ponto to authenticated;
grant select, insert, delete on public.feriados to authenticated;
grant select, insert, update on public.semanas to authenticated;
grant select, insert on public.semana_eventos to authenticated;
grant select, insert, update, delete on public.semana_resultados to authenticated;
grant select, insert, update, delete on public.semana_resultado_dias to authenticated;
grant select, insert on public.importacoes to authenticated;
grant select, insert, update on public.batidas to authenticated;
grant select, insert on public.ponto_lancamentos to authenticated;
grant select, insert, update on public.solicitacoes_correcao to authenticated;
grant select, insert on public.ajustes_saldo to authenticated;
grant select, insert, delete on public.catraca_ids_ignorados to authenticated;

-- Funções: nada para anônimo.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
