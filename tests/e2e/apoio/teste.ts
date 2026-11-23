/**
 * `test` dos specs de navegador: cada sessão (gestora, funcionária, cliente sem login…) é um contexto próprio,
 * e erro de JavaScript em qualquer página reprova o teste no fim. Banco de teste em `db` (só para preparar
 * cenário e conferir o que a tela gravou).
 */
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import type { Client } from "pg";

import { BASE, conectarBanco } from "./ambiente";

export const SENHA_DEV = "Cristinas2026";
/** "Hoje" em SQL no fuso da loja (o banco roda em UTC: depois das 21h o current_date já é amanhã). */
export const HOJE_SQL = "(now() at time zone 'America/Sao_Paulo')::date";
export const DESKTOP = { width: 1440, height: 900 };
export const CELULAR = { width: 390, height: 844 };
type Tela = typeof DESKTOP;

interface Fixtures {
  /** Página nova numa sessão separada (sem login). */
  novaPagina: (viewport?: Tela) => Promise<Page>;
  /** Página nova já logada. */
  entrar: (login: string, opcoes?: { viewport?: Tela; senha?: string }) => Promise<Page>;
}

export const test = base.extend<Fixtures, { db: Client }>({
  db: [
    async ({}, usar) => {
      const db = await conectarBanco();
      await usar(db);
      await db.end();
    },
    { scope: "worker" },
  ],
  novaPagina: async ({ browser }, usar) => {
    const contextos: BrowserContext[] = [];
    const erros: string[] = [];
    await usar(async (viewport = DESKTOP) => {
      const ctx = await browser.newContext({ baseURL: BASE, viewport, locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: viewport.width < 500 ? 2 : 1 });
      contextos.push(ctx);
      const p = await ctx.newPage();
      p.on("pageerror", (e) => erros.push(`${p.url()}: ${e.message}`));
      return p;
    });
    for (const c of contextos) await c.close();
    expect(erros, "erro de JavaScript nas páginas").toEqual([]);
  },
  entrar: async ({ novaPagina }, usar) => {
    await usar(async (login, { viewport, senha = SENHA_DEV } = {}) => {
      const p = await novaPagina(viewport);
      await p.goto("/login");
      await p.fill('input[name="login"]', login);
      await p.fill('input[name="senha"]', senha);
      await p.click('button[type="submit"]');
      await p.waitForURL((u) => !u.pathname.startsWith("/login"));
      return p;
    });
  },
});

export { expect };

/** Vai para a rota e espera a página assentar (campo controlado preenchido antes da hidratação é desfeito). */
export async function ir(p: Page, rota: string) {
  await p.goto(rota);
  await p.waitForLoadState("networkidle");
}

/** Download com a sessão, de dentro da página: em produção o cookie é Secure e o cliente HTTP avulso não o manda em http://. */
export function baixar(p: Page, url: string) {
  return p.evaluate(async (u) => {
    const r = await fetch(u, { redirect: "manual" });
    return { status: r.status, tipo: r.headers.get("content-type") ?? "" };
  }, url);
}

export const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/**
 * Login da funcionária pelo ID da catraca. Os specs não citam nomes nem logins de funcionária: o banco de teste
 * pode ter o cadastro real (dados/funcionarias.csv, fora do git) ou o de exemplo, com os mesmos IDs.
 */
export async function loginDaCatraca(db: Client, enNo: string): Promise<string> {
  const { rows } = await db.query(
    `select split_part(u.email, '@', 1) login from public.perfis p
       join public.funcionarias f on f.id = p.funcionaria_id
       join auth.users u on u.id = p.id
      where f.en_no = $1 and p.ativo`,
    [enNo],
  );
  if (!rows[0]) throw new Error(`Nenhuma funcionária com acesso ativo e ID de catraca ${enNo} no banco de teste.`);
  return rows[0].login as string;
}

/** Primeira linha de uma consulta. */
export async function linha<T = Record<string, unknown>>(db: Client, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await db.query(sql, params)).rows[0] as T | undefined;
}
