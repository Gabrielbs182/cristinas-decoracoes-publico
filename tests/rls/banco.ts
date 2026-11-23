/**
 * Base dos testes de banco (RLS, funções, storage), testada no próprio Postgres do Supabase local.
 *
 * Cada teste roda numa transação que termina em ROLLBACK: monta os dados como superusuário,
 * troca para o papel `authenticated` com o JWT de um usuário (é assim que o PostgREST alimenta
 * o auth.uid()) e verifica o que ele vê e o que consegue gravar. O banco de dev não é tocado.
 *
 * Roda no AMBIENTE DE TESTE (Supabase 573xx: `npx supabase start --workdir .ambiente-teste`), não no banco de
 * uso (553xx), que tem dados reais desde 24/10/2026. URL: SUPABASE_DB_URL (padrão: banco de teste, 57322).
 */
import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll } from "vitest";

export const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:57322/postgres";
export const SEGUNDA = "2031-03-03"; // semana longe dos dados de dev
export const TERCA = "2031-03-04";
/** Pedido de correção só aceita dia que já passou: semana passada, também longe dos dados de dev. */
export const SEGUNDA_PASSADA = "2021-03-01";
export const TERCA_PASSADA = "2021-03-02";
/**
 * "Hoje" em SQL, no fuso da loja. O banco roda em UTC: depois das 21h de Brasília o current_date já é amanhã, e o
 * banco (que usa a data de São Paulo) recusava "pagamento no futuro" — os testes falhavam toda noite.
 */
export const HOJE = "(now() at time zone 'America/Sao_Paulo')::date";

export let db: Client;

/** Registra a conexão no arquivo de teste que chamar. */
export function usarBanco() {
  beforeAll(async () => {
    db = new Client({ connectionString: DB_URL });
    try {
      await db.connect();
    } catch (e) {
      throw new Error(`Banco de teste indisponível em ${DB_URL}. Rode "npx supabase start --workdir .ambiente-teste". (${(e as Error).message})`);
    }
  });
  afterAll(async () => db?.end());
}

export interface Cenario {
  gestora: string;
  contador: string;
  f1: { uid: string; id: string };
  f2: { uid: string; id: string };
  semPerfil: string;
  desativada: string;
  batidaF1: number;
}

/** Monta usuários e dados dentro da transação corrente (como superusuário). */
export async function montar(): Promise<Cenario> {
  // O banco pode ter semanas abertas com batidas (dados de uso ou de outro roteiro): o fechamento exige fechar
  // as anteriores primeiro. Dentro desta transação (desfeita no fim), tudo antes dos dados de teste conta como fechado.
  await db.query("set local session_replication_role = replica");
  await db.query(
    `insert into semanas (segunda, status) select distinct public.segunda_de(data), 'fechada'::public.status_semana from batidas where data < '2031-01-01'
     on conflict (segunda) do update set status = 'fechada'`,
  );
  await db.query("set local session_replication_role = origin");

  const uid = () => randomUUID();
  const c = { gestora: uid(), contador: uid(), semPerfil: uid(), desativada: uid(), f1u: uid(), f2u: uid() };
  for (const id of Object.values(c)) {
    await db.query("insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')", [id, `${id}@teste.invalid`]);
  }
  const fun = async (nome: string, enNo: string) =>
    (await db.query("insert into funcionarias (nome, nome_exibicao, en_no) values ($1, $1, $2) returning id", [nome, enNo])).rows[0].id as string;
  const f1 = await fun("[teste] F1", "900000001");
  const f2 = await fun("[teste] F2", "900000002");
  const f3 = await fun("[teste] F3", "900000003");

  await db.query(
    `insert into perfis (id, nome, papel, funcionaria_id, ativo) values
      ($1, 'Gestora', 'gestora', null, true),
      ($2, 'Contador', 'contador', null, true),
      ($3, 'F1', 'funcionaria', $4, true),
      ($5, 'F2', 'funcionaria', $6, true),
      ($7, 'F3 desativada', 'funcionaria', $8, false)`,
    [c.gestora, c.contador, c.f1u, f1, c.f2u, f2, c.desativada, f3],
  );

  const imp = (await db.query(
    "insert into importacoes (arquivo_nome, arquivo_sha256, linhas_lidas, batidas_novas, batidas_repetidas, importado_por) values ('t.txt', 'x', 2, 2, 0, $1) returning id",
    [c.gestora],
  )).rows[0].id;
  const batidaF1 = (await db.query(
    "insert into batidas (en_no, funcionaria_id, data, hora_seg, iomd, importacao_id) values ('900000001', $1, $2, 25200, 0, $3) returning id",
    [f1, TERCA, imp],
  )).rows[0].id as number;
  await db.query("insert into batidas (en_no, funcionaria_id, data, hora_seg, iomd, importacao_id) values ('900000002', $1, $2, 25200, 0, $3)", [f2, TERCA, imp]);
  await db.query("insert into batidas (en_no, funcionaria_id, data, hora_seg, iomd, importacao_id) values ('900000099', null, $1, 25200, 0, $2)", [TERCA, imp]);

  for (const [f, autor] of [[f1, c.gestora], [f2, c.gestora]]) {
    await db.query("insert into ponto_lancamentos (funcionaria_id, data, tipo, ocorrencia, motivo, autor) values ($1, $2, 'ocorrencia', 'atestado', 'x', $3)", [f, TERCA, autor]);
    await db.query("insert into ajustes_saldo (funcionaria_id, segunda, minutos, motivo, autor) values ($1, $2, 30, 'x', $3)", [f, SEGUNDA, autor]);
  }
  await db.query("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo, criada_por) values ($1, $2, 'S', 61200, 'x', $3)", [f2, TERCA_PASSADA, c.f2u]);

  await db.query("insert into semanas (segunda, status) values ('2031-02-24', 'fechada')");
  for (const f of [f1, f2]) {
    await db.query(
      `insert into semana_resultados (segunda, funcionaria_id, saldo_anterior_min, extras_semana_min, acumulado_min, fechou_corte, proxima_semana_min, trabalhadas_min, dias_trabalhados)
       values ('2031-02-24', $1, 0, 10, 10, false, 10, 2700, 5)`,
      [f],
    );
  }
  return { gestora: c.gestora, contador: c.contador, semPerfil: c.semPerfil, desativada: c.desativada, f1: { uid: c.f1u, id: f1 }, f2: { uid: c.f2u, id: f2 }, batidaF1 };
}

/** Roda `fn` como o usuário `uid` (papel authenticated) e volta a ser superusuário. */
export async function como<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  if (uid) {
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await db.query("set local role authenticated");
  } else {
    await db.query("set local role anon");
  }
  try {
    return await fn();
  } finally {
    await db.query("reset role");
  }
}

/** Transação com savepoint por operação, para um erro esperado não abortar o resto. */
export async function cenario(fn: (c: Cenario) => Promise<void>) {
  await db.query("begin");
  try {
    await fn(await montar());
  } finally {
    await db.query("rollback");
  }
}

export async function contar(tabela: string, filtro = "true", params: unknown[] = []): Promise<number> {
  return Number((await db.query(`select count(*) from public.${tabela} where ${filtro}`, params)).rows[0].count);
}

/** Executa um comando que deve falhar; devolve a mensagem de erro. */
export async function falha(sql: string, params: unknown[] = []): Promise<string> {
  await db.query("savepoint s");
  try {
    await db.query(sql, params);
  } catch (e) {
    await db.query("rollback to savepoint s");
    return (e as Error).message;
  }
  await db.query("release savepoint s");
  throw new Error(`Esperava erro e o comando passou: ${sql}`);
}

/** Linhas afetadas por um UPDATE/DELETE (RLS costuma "esconder" a linha em vez de dar erro). */
export async function afetadas(sql: string, params: unknown[] = []): Promise<number> {
  return (await db.query(sql, params)).rowCount ?? 0;
}

export const TESTE = "funcionaria_id in (select id from funcionarias where nome like '[teste]%')";
