/**
 * Postura de segurança do banco inteiro, lida do catálogo: vale para tabela, função e bucket que ainda nem existem.
 * Os testes por módulo (equipe, vendas, orçamentos…) conferem o que cada papel vê; este confere que nada novo
 * nasce aberto. Quem cria tabela, função SECURITY DEFINER ou permissão nova precisa atualizar as listas abaixo —
 * de propósito: é a revisão de segurança acontecendo no mesmo commit.
 */
import { describe, expect, it } from "vitest";

import { db, usarBanco } from "./banco";

usarBanco();

const linhas = async (sql: string) => (await db.query(sql)).rows;
const nomes = async (sql: string) => (await linhas(sql)).map((r) => Object.values(r).join(" "));

/** Funções que rodam com o dono (ignoram RLS). Cada uma confere o papel por dentro; revisadas em 24/10/2026. */
const SECURITY_DEFINER = [
  "alterar_meu_nome",
  "aprovar_orcamento_publico",
  "criar_perfil",
  "definir_proximo_numero",
  "definir_regras",
  "documento_orcamento",
  "eh_gestora",
  "funcionaria_atual",
  "montar_documento_orcamento", // sem execute para ninguém: só documento_orcamento e orcamento_publico a chamam
  "orcamento_publico",
  "papel_atual",
  "semana_fechada",
  "tem_perfil",
];

/** O que o papel `authenticated` pode fazer em cada tabela (o RLS decide as linhas; isto decide os comandos). */
const PERMISSOES_AUTHENTICATED: Record<string, string> = {
  ajustes_saldo: "INSERT,SELECT",
  batidas: "INSERT,SELECT,UPDATE",
  catraca_ids_ignorados: "DELETE,INSERT,SELECT",
  clientes: "DELETE,INSERT,SELECT,UPDATE",
  empresa: "SELECT,UPDATE",
  feriados: "DELETE,INSERT,SELECT",
  funcionarias: "INSERT,SELECT,UPDATE",
  importacoes: "INSERT,SELECT",
  modelos_confeccao: "INSERT,SELECT,UPDATE",
  numeracao: "SELECT",
  orcamento_ambientes: "DELETE,INSERT,SELECT,UPDATE",
  orcamento_itens: "DELETE,INSERT,SELECT,UPDATE",
  orcamentos: "INSERT,SELECT,UPDATE",
  perfis: "SELECT,UPDATE",
  ponto_lancamentos: "INSERT,SELECT",
  produtos: "INSERT,SELECT,UPDATE",
  recibos: "INSERT,SELECT,UPDATE",
  regras_orcamento: "SELECT,UPDATE",
  regras_ponto: "INSERT,SELECT",
  saldos_orcamentos: "SELECT",
  semana_eventos: "INSERT,SELECT",
  semana_resultado_dias: "DELETE,INSERT,SELECT,UPDATE",
  semana_resultados: "DELETE,INSERT,SELECT,UPDATE",
  semanas: "INSERT,SELECT,UPDATE",
  solicitacoes_correcao: "INSERT,SELECT,UPDATE",
};

describe("cobertura de RLS e permissões (catálogo)", () => {
  it("toda tabela do public tem RLS ligado e ao menos uma policy", async () => {
    expect(await nomes("select relname from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relrowsecurity")).toEqual([]);
    expect(
      await nomes(`select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
                     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)`),
    ).toEqual([]);
  });

  it("toda policy é só para usuário logado e nenhuma libera tudo (true)", async () => {
    expect(await nomes("select tablename || '.' || policyname from pg_policies where schemaname in ('public', 'storage') and not (roles <@ array['authenticated']::name[])")).toEqual([]);
    expect(await nomes("select tablename || '.' || policyname from pg_policies where schemaname in ('public', 'storage') and (qual = 'true' or with_check = 'true')")).toEqual([]);
  });

  // aclexplode lê o privilégio cru (inclui MAINTAIN, que o information_schema não mostra) de tabela, view e sequência.
  const privilegios = (papel: string, filtro = "true") =>
    nomes(`select c.relname || ' ' || a.privilege_type from pg_class c, aclexplode(c.relacl) a
            where c.relnamespace = 'public'::regnamespace and pg_get_userbyid(a.grantee) = '${papel}' and ${filtro} order by 1`);

  // Regressão (24/10/2026): a view saldos_orcamentos nasceu com TRUNCATE/TRIGGER/REFERENCES, e todo objeto com
  // MAINTAIN (VACUUM, LOCK TABLE…) e setval nas sequências, para anon e authenticated.
  it("anon não tem privilégio nenhum em tabela, view ou sequência", async () => {
    expect(await privilegios("anon")).toEqual([]);
  });

  it("authenticated não tem TRUNCATE, TRIGGER, REFERENCES nem MAINTAIN, nem altera sequência", async () => {
    expect(await privilegios("authenticated", "(a.privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN') or (c.relkind = 'S' and a.privilege_type = 'UPDATE'))")).toEqual([]);
  });

  it("permissões do authenticated por tabela e view são as revisadas", async () => {
    const atuais = await linhas(
      `select c.relname, string_agg(a.privilege_type, ',' order by a.privilege_type) permissoes from pg_class c, aclexplode(c.relacl) a
        where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v') and pg_get_userbyid(a.grantee) = 'authenticated' group by c.relname`,
    );
    expect(Object.fromEntries(atuais.map((r) => [r.relname, r.permissoes]))).toEqual(PERMISSOES_AUTHENTICATED);
  });

  it("anon só executa as duas funções da página pública do orçamento", async () => {
    expect(
      await nomes(`select proname from pg_proc where pronamespace = 'public'::regnamespace and prorettype <> 'trigger'::regtype
                     and has_function_privilege('anon', oid, 'execute') order by 1`),
    ).toEqual(["aprovar_orcamento_publico", "orcamento_publico"]);
  });

  it("funções SECURITY DEFINER: só as revisadas, todas com search_path fixo", async () => {
    expect(await nomes("select proname from pg_proc where prosecdef and pronamespace = 'public'::regnamespace and prorettype <> 'trigger'::regtype order by 1")).toEqual(
      SECURITY_DEFINER,
    );
    expect(
      await nomes(`select proname from pg_proc where prosecdef and pronamespace = 'public'::regnamespace
                     and not exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%')`),
    ).toEqual([]);
  });

  it("views respeitam o RLS de quem consulta (security_invoker)", async () => {
    expect(
      await nomes(`select relname from pg_class where relkind = 'v' and relnamespace = 'public'::regnamespace
                     and not exists (select 1 from unnest(coalesce(reloptions, '{}')) o where o in ('security_invoker=true', 'security_invoker=on'))`),
    ).toEqual([]);
  });

  it("buckets do Storage são privados e limitam tamanho e tipo", async () => {
    expect(await nomes("select id from storage.buckets where public or file_size_limit is null or allowed_mime_types is null")).toEqual([]);
  });
});
