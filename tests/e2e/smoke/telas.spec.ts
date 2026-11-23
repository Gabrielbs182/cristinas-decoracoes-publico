/**
 * Smoke de telas: abre TODA tela do app com cada papel (sem login, gestora, contador, funcionária) e confere
 *  - se vai para onde a matriz de acesso (rotas.ts) manda;
 *  - nas telas que abrem: HTTP < 400, sem erro de JavaScript nem console.error, sem requisição do app falhando,
 *    sem página de erro do Next, com <title> e <h1>, sem imagem quebrada, sem campo/botão/link sem nome
 *    acessível, sem id repetido, sem campo espremido (< 48 px) e, no celular (390 px), sem rolagem lateral;
 *  - nos arquivos (PDF, planilha): o status de cada papel.
 * Fotos de cada tela (computador e celular) ficam em test-results/telas/<papel>/ para a revisão visual.
 */
import path from "node:path";

import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { Client } from "pg";

import { BASE } from "../apoio/ambiente";
import { CELULAR, DESKTOP, HOJE_SQL, SENHA_DEV, expect, linha, loginDaCatraca, test } from "../apoio/teste";
import { ARQUIVOS, PAPEIS, TELAS, descobrir, type Destino, type Papel } from "./rotas";

type Sessao = Awaited<ReturnType<BrowserContext["storageState"]>>;
const sessoes: Partial<Record<Papel, Sessao>> = {};
/** Rota com parâmetro → endereço real montado com dados do banco de teste (null: não há dado para montar). */
const enderecos: Record<string, string | null> = {};
const endereco = (rota: string) => (rota.includes("[") ? enderecos[rota] : rota);
const FUNCIONARIA_DO_SMOKE = "000000005";
/** Tipo de conteúdo das rotas que não são PDF nem planilha. */
const TIPO_ESPERADO: Record<string, RegExp> = { "/api/saude": /application\/json/, "/modelos/recuperar-senha": /text\/html/ };

/** Cliente, orçamentos e recibo próprios do smoke (refeitos a cada rodada) + o que já houver de semana fechada. */
async function prepararAlvos(db: Client) {
  await db.query("delete from recibos where pagador = 'Smoke (teste)'");
  await db.query("delete from orcamentos where cliente_id in (select id from clientes where nome = 'Cliente Smoke (teste)')");
  await db.query("delete from clientes where nome = 'Cliente Smoke (teste)'");
  const { id: cliente } = (await linha<{ id: string }>(db, "insert into clientes (nome, telefone) values ('Cliente Smoke (teste)', '(19) 96666-0000') returning id"))!;
  const novoOrcamento = async () => {
    const { id } = (await linha<{ id: string }>(db, "insert into orcamentos (cliente_id) values ($1) returning id", [cliente]))!;
    const { id: amb } = (await linha<{ id: string }>(db, "insert into orcamento_ambientes (id, orcamento_id, ordem, nome) values (gen_random_uuid(), $1, 0, 'Sala') returning id", [id]))!;
    await db.query(
      `insert into orcamento_itens (id, orcamento_id, ambiente_id, ordem, tipo, quantidade, precos, linhas, descricao, unitario_centavos, total_centavos)
       values (gen_random_uuid(), $1, $2, 0, 'servico', 1, '{}', '[]', 'Instalação (smoke)', 15000, 15000)`,
      [id, amb],
    );
    await db.query("update orcamentos set subtotal_centavos = 15000, total_centavos = 15000 where id = $1", [id]);
    return id;
  };
  const rascunho = await novoOrcamento();
  const enviado = await novoOrcamento();
  await db.query("update orcamentos set status = 'enviado' where id = $1", [enviado]);
  const { token } = (await linha<{ token: string }>(db, "select token from orcamentos where id = $1", [enviado]))!;
  const { id: recibo } = (await linha<{ id: string }>(
    db,
    `insert into recibos (tipo, pagador, referente, valor_centavos, forma, data_pagamento)
     values ('avulso', 'Smoke (teste)', 'teste das telas', 1000, 'pix', ${HOJE_SQL}) returning id`,
  ))!;
  const semana = (await linha<{ s: string }>(db, "select segunda::text s from semanas where status = 'fechada' order by segunda desc limit 1"))?.s;
  const espelho = await linha<{ f: string; s: string }>(
    db,
    `select split_part(name, '/', 1) f, replace(split_part(name, '/', 2), '.pdf', '') s from storage.objects
      where bucket_id = 'espelhos' and split_part(name, '/', 1) <> (select id::text from funcionarias where en_no = $1)
      order by name desc limit 1`,
    [FUNCIONARIA_DO_SMOKE],
  );
  Object.assign(enderecos, {
    "/clientes/[id]": `/clientes/${cliente}`,
    "/orcamentos/[id]": `/orcamentos/${rascunho}`,
    "/recibos/[id]": `/recibos/${recibo}`,
    "/rh/semanas/[segunda]": semana ? `/rh/semanas/${semana}` : null,
    "/o/[token]": `/o/${token}`,
    "/o/[token]/pdf": `/o/${token}/pdf`,
    "/arquivos/orcamento/[id]": `/arquivos/orcamento/${rascunho}`,
    "/arquivos/recibo/[id]": `/arquivos/recibo/${recibo}`,
    "/arquivos/planilha/[segunda]": semana ? `/arquivos/planilha/${semana}` : null,
    "/arquivos/espelho/[segunda]/[funcionaria]": espelho ? `/arquivos/espelho/${espelho.s}/${espelho.f}` : null,
  });
}

test.beforeAll(async ({ browser, db }) => {
  test.setTimeout(120_000);
  await prepararAlvos(db);
  const logins: Record<Exclude<Papel, "anonimo">, string> = { gestora: "cristina", contador: "contador", funcionaria: await loginDaCatraca(db, FUNCIONARIA_DO_SMOKE) };
  for (const [papel, login] of Object.entries(logins) as [Papel, string][]) {
    const ctx = await browser.newContext({ baseURL: BASE });
    const p = await ctx.newPage();
    await p.goto("/login");
    await p.fill('input[name="login"]', login);
    await p.fill('input[name="senha"]', SENHA_DEV);
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    sessoes[papel] = await ctx.storageState();
    await ctx.close();
  }
});

const abrir = (browser: Browser, papel: Papel, viewport = DESKTOP) =>
  browser.newContext({ baseURL: BASE, viewport, locale: "pt-BR", timezoneId: "America/Sao_Paulo", storageState: sessoes[papel] });

/** Erros que a página produz enquanto está aberta. */
function vigiar(p: Page, problemas: string[]) {
  const doApp = (url: string) => url.startsWith(BASE);
  p.on("pageerror", (e) => problemas.push(`erro de JavaScript: ${e.message}`));
  p.on("console", (m) => {
    // "Failed to load resource" do próprio app já entra pela resposta abaixo, com o endereço.
    if (m.type() === "error" && !(m.text().startsWith("Failed to load resource") && doApp(m.location().url))) problemas.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  p.on("response", (r) => {
    if (doApp(r.url()) && r.status() >= 400 && r.request().resourceType() !== "document") problemas.push(`HTTP ${r.status()} em ${r.url().slice(BASE.length)}`);
  });
  p.on("requestfailed", (r) => {
    // ERR_ABORTED = prefetch cancelado pela própria navegação.
    if (doApp(r.url()) && r.failure()?.errorText !== "net::ERR_ABORTED") problemas.push(`requisição falhou: ${r.url().slice(BASE.length)} (${r.failure()?.errorText})`);
  });
}

/** Conferências de conteúdo e acessibilidade básicas, no DOM da tela aberta. */
const conferirConteudo = (p: Page) =>
  p.evaluate(() => {
    const problemas: string[] = [];
    const visivel = (e: Element) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === "fixed";
    const descrever = (e: Element) => e.outerHTML.slice(0, 160).replace(/\s+/g, " ");
    if (/Application error|This page could not be found|Internal Server Error/i.test(document.body.innerText)) problemas.push("página de erro do Next");
    if (!document.title.trim()) problemas.push("sem <title>");
    if (![...document.querySelectorAll("h1")].some(visivel)) problemas.push("sem <h1> visível");
    for (const img of document.querySelectorAll("img")) if (img.complete && img.naturalWidth === 0) problemas.push(`imagem quebrada: ${img.getAttribute("src")}`);
    for (const e of document.querySelectorAll<HTMLInputElement>("input, select, textarea")) {
      if (e.type === "hidden" || !visivel(e)) continue;
      const nome = e.labels?.length || e.getAttribute("aria-label")?.trim() || e.getAttribute("aria-labelledby") || e.title.trim();
      if (!nome) problemas.push(`campo sem rótulo: ${descrever(e)}`);
    }
    for (const e of document.querySelectorAll("button, a[href], [role=button]")) {
      if (!visivel(e)) continue;
      const nome = e.textContent?.trim() || e.getAttribute("aria-label")?.trim() || e.getAttribute("aria-labelledby") || e.getAttribute("title")?.trim() || e.querySelector("img[alt]:not([alt=''])");
      if (!nome) problemas.push(`${e.tagName.toLowerCase()} sem nome acessível: ${descrever(e)}`);
    }
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id).filter(Boolean);
    for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) problemas.push(`id repetido: #${id}`);
    return problemas;
  });

/**
 * Campo estreito demais para ler o que se digita. Regressão (24/10/2026): no celular, o nome do ambiente do
 * orçamento ficava com ~20 px — flex-1 + min-w-0 dava base 0, a linha nunca quebrava e o campo encolhia.
 */
const camposEspremidos = (p: Page) =>
  p.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea")]
      .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().width < 48)
      .map((e) => `campo espremido (${Math.round(e.getBoundingClientRect().width)} px): ${e.getAttribute("aria-label") ?? e.getAttribute("name") ?? e.outerHTML.slice(0, 100)}`),
  );

/** Elementos que passam da largura da tela (para achar o culpado da rolagem lateral). */
const rolagemLateral = (p: Page) =>
  p.evaluate(() => {
    const largura = window.innerWidth;
    if (document.documentElement.scrollWidth <= largura) return null;
    const culpados = [...document.body.querySelectorAll("*")]
      .filter((e) => e.getBoundingClientRect().right > largura + 1 && ![...e.children].some((f) => f.getBoundingClientRect().right > largura + 1))
      .slice(0, 3)
      .map((e) => `<${e.tagName.toLowerCase()} class="${(e.getAttribute("class") ?? "").slice(0, 80)}">`);
    return `rolagem lateral no celular (${document.documentElement.scrollWidth}px > ${largura}px): ${culpados.join(", ")}`;
  });

/**
 * Abre o endereço. Erro de rede do próprio Windows (ERR_NO_BUFFER_SPACE: portas esgotadas numa rodada longa, com
 * centenas de sessões) ganha uma segunda tentativa, anotada no relatório; qualquer outro erro falha na hora.
 */
async function abrirEndereco(p: Page, url: string) {
  try {
    return await p.goto(url, { waitUntil: "networkidle" });
  } catch (e) {
    if (!/net::ERR_NO_BUFFER_SPACE/.test((e as Error).message)) throw e;
    test.info().annotations.push({ type: "rede", description: `${url}: ERR_NO_BUFFER_SPACE, segunda tentativa` });
    await p.waitForTimeout(3_000);
    return p.goto(url, { waitUntil: "networkidle" });
  }
}

const foto = (papel: Papel, rota: string, sufixo = "") =>
  path.join("test-results", "telas", papel, `${rota.replace(/^\//, "").replace(/[/[\]]+/g, "_") || "raiz"}${sufixo}.png`);

const caminhoEsperado = (destino: Destino, caminho: string) =>
  destino === "abre" ? caminho : destino === "login" ? "/login" : destino === "negado" ? "/sem-permissao" : destino;

async function conferirTela(browser: Browser, papel: Papel, rota: string, url: string, destino: Destino): Promise<string[]> {
  const problemas: string[] = [];
  const caminho = new URL(url, BASE).pathname;
  const esperado = caminhoEsperado(destino, caminho);
  for (const [viewport, sufixo] of [[DESKTOP, ""], [CELULAR, "-celular"]] as const) {
    const ctx = await abrir(browser, papel, viewport);
    try {
      const p = await ctx.newPage();
      vigiar(p, problemas);
      const resposta = await abrirEndereco(p, url);
      const chegou = new URL(p.url()).pathname;
      if (chegou !== esperado) {
        problemas.push(`esperava ${destino === "abre" ? "abrir" : `ir para ${esperado}`}, foi para ${chegou}`);
        return problemas;
      }
      if (destino !== "abre") return problemas; // redirecionou como devia: a tela de destino tem o próprio teste
      if (resposta && resposta.status() >= 400) problemas.push(`HTTP ${resposta.status()}`);
      if (viewport === DESKTOP) problemas.push(...(await conferirConteudo(p)));
      else {
        const lateral = await rolagemLateral(p);
        if (lateral) problemas.push(lateral);
      }
      problemas.push(...(await camposEspremidos(p)).map((x) => `${x}${sufixo ? " (celular)" : ""}`));
      await p.screenshot({ path: foto(papel, rota, sufixo), fullPage: true });
    } finally {
      await ctx.close();
    }
  }
  return [...new Set(problemas)];
}

test("toda tela e todo arquivo do app estão na matriz de acesso", () => {
  expect(descobrir("page.tsx"), "tela nova? decida quem abre em tests/e2e/smoke/rotas.ts").toEqual(Object.keys(TELAS).sort());
  expect(descobrir("route.ts"), "rota de arquivo nova? decida quem baixa em tests/e2e/smoke/rotas.ts").toEqual(Object.keys(ARQUIVOS).sort());
});

for (const [rota, acesso] of Object.entries(TELAS)) {
  test(`tela ${rota}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const url = endereco(rota);
    test.skip(!url, "o banco de teste não tem dado para montar este endereço (sem semana fechada?)");
    for (const papel of PAPEIS) {
      await test.step(papel, async () => {
        expect.soft(await conferirTela(browser, papel, rota, url!, acesso[papel]), `${rota} como ${papel}`).toEqual([]);
      });
    }
  });
}

for (const [rota, acesso] of Object.entries(ARQUIVOS)) {
  test(`arquivo ${rota}`, async ({ browser }) => {
    test.skip(acesso === "regressao", "coberto pela regressão (precisa de envio pelo portal)");
    const url = endereco(rota);
    test.skip(!url, "o banco de teste não tem dado para montar este endereço (sem semana fechada?)");
    if (acesso === "regressao") return;
    for (const papel of PAPEIS) {
      const ctx = await abrir(browser, papel);
      const p = await ctx.newPage();
      await p.goto(papel === "anonimo" ? "/login" : "/sem-permissao");
      const r = await p.evaluate(async (u) => {
        const r = await fetch(u, { redirect: "manual" });
        return { status: r.status, redirecionou: r.type === "opaqueredirect", tipo: r.headers.get("content-type") ?? "" };
      }, url!);
      await ctx.close();
      const obtido = r.redirecionou ? "login" : r.status;
      expect.soft(obtido, `${rota} como ${papel}`).toBe(acesso[papel]);
      if (obtido === 200) expect.soft(r.tipo, `${rota} como ${papel}: tipo do arquivo`).toMatch(TIPO_ESPERADO[rota] ?? /application\/pdf|spreadsheetml/);
    }
  });
}
