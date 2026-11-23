-- =====================================================================
-- 0.6 — Perfil de um login novo. O login (auth.users) é criado pela API de admin no servidor; o perfil,
-- que decide o que a pessoa vê, é criado aqui com a sessão da gestora.
-- =====================================================================

create function public.criar_perfil(p_usuario uuid, p_nome text, p_papel public.papel, p_funcionaria uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_nome text := trim(coalesce(p_nome, ''));
begin
  if not public.eh_gestora() then
    raise exception 'Apenas a gestora cria acessos.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_usuario) then
    raise exception 'Login não encontrado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.perfis where id = p_usuario) then
    raise exception 'Esse login já tem perfil.' using errcode = 'P0001';
  end if;

  if p_papel = 'funcionaria' then
    -- O nome começa como o do cadastro; depois é ela quem escolhe.
    select nome_exibicao into v_nome from public.funcionarias where id = p_funcionaria and ativa;
    if not found then
      raise exception 'Funcionária não encontrada ou inativa.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.perfis where funcionaria_id = p_funcionaria) then
      raise exception 'Essa funcionária já tem acesso. Para entrar de novo, gere um link novo.' using errcode = 'P0001';
    end if;
  elsif p_funcionaria is not null then
    raise exception 'Só perfil de funcionária aponta para um cadastro.' using errcode = 'P0001';
  end if;
  if length(v_nome) < 2 then
    raise exception 'Informe o nome.' using errcode = 'P0001';
  end if;

  insert into public.perfis (id, nome, papel, funcionaria_id, ativo) values (p_usuario, v_nome, p_papel, p_funcionaria, true);
end;
$$;

revoke execute on function public.criar_perfil(uuid, text, public.papel, uuid) from public, anon;
grant execute on function public.criar_perfil(uuid, text, public.papel, uuid) to authenticated;
