-- Linhas por tabela (public, auth, storage), em ordem: a cópia guarda e a restauração compara.
select format('select %L || ''|'' || count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r', 'p') and n.nspname in ('public', 'auth', 'storage')
   and (n.nspname, c.relname) not in (('auth', 'schema_migrations'), ('storage', 'migrations'))
 order by n.nspname, c.relname
\gexec
