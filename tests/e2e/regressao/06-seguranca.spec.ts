/**
 * Achados da auditoria de segurança de 24/10/2026, conferidos no navegador (app em modo produção):
 * redirecionamento depois do login só para dentro do site, cookie da sessão HttpOnly e curto, cabeçalhos de
 * segurança em página e em arquivo.
 */
import type { Page } from "@playwright/test";

import { BASE, MAILPIT, adminDoTeste } from "../apoio/ambiente";
import { codigoNovo, codigoTotp } from "../apoio/totp";
import { SENHA_DEV, baixar, expect, ir, test } from "../apoio/teste";

/** Mensagem de erro do formulário (o Next tem um role="alert" próprio, vazio: o anunciador de mudança de rota). */
const alerta = (p: Page) => p.locator('[role="alert"]:not(#__next-route-announcer__)');

const CABECALHOS = {
  "content-security-policy": "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
};

test("depois do login, ?volta= só leva para dentro do site", async ({ novaPagina }) => {
  for (const volta of ["/\\evil.example/login", "/\t/evil.example", "//evil.example"]) {
    await test.step(JSON.stringify(volta), async () => {
      const p = await novaPagina();
      // Se o app redirecionar para fora, a "cópia falsa" responde aqui (nada sai para a rede).
      await p.context().route((u) => u.hostname === "evil.example", (r) => r.fulfill({ body: "<h1>copia falsa do login</h1>", contentType: "text/html" }));
      await p.goto(`/login?volta=${encodeURIComponent(volta)}`);
      await p.waitForLoadState("networkidle");
      await p.fill('input[name="login"]', "cristina");
      await p.fill('input[name="senha"]', SENHA_DEV);
      await p.click('button[type="submit"]');
      await p.waitForURL((u) => !u.pathname.startsWith("/login"));
      expect(new URL(p.url()).origin, `foi para ${p.url()}`).toBe(BASE);
    });
  }
  await test.step("caminho interno continua valendo", async () => {
    const p = await novaPagina();
    await p.goto("/orcamentos");
    await expect(p).toHaveURL(/\/login\?volta=%2Forcamentos/);
    await p.fill('input[name="login"]', "cristina");
    await p.fill('input[name="senha"]', SENHA_DEV);
    await p.click('button[type="submit"]');
    await expect(p).toHaveURL(`${BASE}/orcamentos`);
  });
});

test("cookie da sessão: HttpOnly, SameSite=Lax, Secure e até 30 dias", async ({ entrar }) => {
  const p = await entrar("cristina");
  const sessao = (await p.context().cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name));
  expect(sessao.length, "cookie da sessão do Supabase").toBeGreaterThan(0);
  const em31Dias = Date.now() / 1000 + 31 * 24 * 3600;
  for (const c of sessao) {
    expect.soft(c.httpOnly, `${c.name} HttpOnly`).toBe(true);
    expect.soft(c.sameSite, `${c.name} SameSite`).toBe("Lax");
    expect.soft(c.secure, `${c.name} Secure (modo produção)`).toBe(true);
    expect.soft(c.expires, `${c.name} vence em até 30 dias`).toBeLessThan(em31Dias);
  }
  expect(await p.evaluate(() => document.cookie), "o JavaScript da página não lê a sessão").not.toMatch(/sb-.*-auth-token/);
});

test("cabeçalhos de segurança em página, redirecionamento e arquivo", async ({ novaPagina, entrar }) => {
  const anon = await novaPagina();
  const login = await anon.goto("/login");
  const protegida = await anon.request.get("/inicio", { maxRedirects: 0 });
  const g = await entrar("cristina");
  const arquivo = await g.evaluate(async () => {
    const r = await fetch("/arquivos/recibos");
    return Object.fromEntries(r.headers.entries());
  });
  for (const [onde, cabecalhos] of [
    ["página /login", login!.headers()],
    ["redirecionamento para o login", protegida.headers()],
    ["arquivo /arquivos/recibos", arquivo],
  ] as const) {
    expect.soft(cabecalhos, onde).toMatchObject(CABECALHOS);
    expect.soft(cabecalhos["x-powered-by"], `${onde}: sem X-Powered-By`).toBeUndefined();
  }
  expect.soft((await baixar(g, "/arquivos/recibos")).status).toBe(200);
});

// Regressão (auditoria, B6): o login não tinha limite de tentativas no app (o do Auth só vê o IP do servidor).
test("login: 5 erros seguidos travam aquele usuário por 15 min; os outros continuam entrando", async ({ novaPagina, entrar }) => {
  const p = await novaPagina();
  await p.goto("/login");
  // Login novo a cada rodada: o servidor lembra as tentativas por 15 min (e o app pode estar aberto de antes).
  const login = `tentativa.${Date.now().toString(36)}`;
  const tentar = async (senha: string) => {
    await p.fill('input[name="login"]', login);
    await p.fill('input[name="senha"]', senha);
    await Promise.all([p.waitForResponse((r) => r.request().method() === "POST"), p.click('button[type="submit"]')]);
    // A server action limpa os campos quando termina. Regressão (CI, 25/10/2026): sem esperar isso, a senha da
    // tentativa seguinte era digitada antes da limpeza e o envio saía vazio (não conta como erro), e a 6ª passava.
    await expect(p.locator('input[name="senha"]')).toHaveValue("");
  };
  for (let i = 1; i <= 5; i++) {
    await tentar(`Errada${i}x`);
    await expect(alerta(p), `tentativa ${i}`).toHaveText("Usuário ou senha incorretos.");
  }
  await tentar("Errada6x");
  await expect(alerta(p)).toHaveText("Muitas tentativas erradas. Espere 15 minutos e tente de novo.");
  await entrar("cristina"); // outro usuário, mesmo IP: entra normalmente
});

// Regressão (auditoria, B6): trocar a senha já logada não pedia a senha atual — um celular desbloqueado bastava.
test("trocar a senha pede a senha atual", async ({ entrar }) => {
  const c = await entrar("contador");
  const trocar = async (atual: string, nova: string) => {
    await ir(c, "/definir-senha");
    await expect(c.getByRole("button", { name: "Salvar senha" }), "sem a senha atual não salva").toBeDisabled();
    await c.getByLabel("Senha atual").fill(atual);
    await c.getByLabel("Senha nova").fill(nova);
    await c.getByLabel("Repita a senha").fill(nova);
    await c.getByRole("button", { name: "Salvar senha" }).click();
  };
  await trocar("NaoEhEssa2026", "Trocada2026");
  await expect(alerta(c)).toHaveText("A senha atual não confere.");
  await trocar(SENHA_DEV, "Trocada2026");
  await c.waitForURL(/\/rh\/semanas/);
  // Volta para a senha de dev (os specs seguintes entram com ela).
  await trocar("Trocada2026", SENHA_DEV);
  await c.waitForURL(/\/rh\/semanas/);
});

// Decisão de 25/10/2026: quem entra com e-mail recupera a senha sozinho. O link do e-mail vai para a tela de criar
// senha do sistema (o padrão do Supabase levaria ao Auth, que na VPS não fica na internet).
test("esqueci minha senha por e-mail: o link chega e cria a senha nova", async ({ novaPagina, request }) => {
  const email = `recupera.${Date.now().toString(36)}@exemplo.com`;
  const adm = adminDoTeste();
  const { data, error } = await adm.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const { error: ePerfil } = await adm.from("perfis").insert({ id: data.user.id, nome: "Recupera E2E", papel: "contador", funcionaria_id: null, ativo: true });
  if (ePerfil) throw ePerfil;
  try {
    const p = await novaPagina();
    await ir(p, "/login");
    await p.fill('input[name="login"]', email);
    await p.getByRole("button", { name: "Esqueci minha senha" }).click();
    await p.getByRole("button", { name: "Mandar o link por e-mail" }).click();
    await expect(p.getByText("Se este e-mail tiver acesso, mandamos um link")).toBeVisible();

    let link = "";
    for (let i = 0; i < 20 && !link; i++) {
      const busca = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
      const id = busca.messages?.[0]?.ID;
      if (id) link = ((await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()).HTML as string).match(/href="([^"]*\/auth\/confirmar\?token_hash=[^"]+)"/)?.[1] ?? "";
      if (!link) await p.waitForTimeout(500);
    }
    expect(link.startsWith(`${BASE}/auth/confirmar?token_hash=`), `link do e-mail: ${link}`).toBe(true);

    await ir(p, link.replaceAll("&amp;", "&"));
    await p.getByLabel("Senha nova").fill("Recuperada2026");
    await p.getByLabel("Repita a senha").fill("Recuperada2026");
    await p.getByRole("button", { name: "Salvar senha" }).click();
    await p.waitForURL(/\/rh\/semanas/);
  } finally {
    await adm.auth.admin.deleteUser(data.user.id);
  }
});

// Decisão de 25/10/2026: verificação em duas etapas opcional. Quem liga entra com senha + código do app, e antes do
// código nada abre (telas, arquivos). Desligar volta ao login só com senha.
test("duas etapas: ligar, o login pede o código (nada abre antes dele), desligar", async ({ novaPagina, entrar }) => {
  const email = `duas.${Date.now().toString(36)}@exemplo.com`;
  const senha = "DuasEtapas2026";
  const adm = adminDoTeste();
  const { data, error } = await adm.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw error;
  const { error: ePerfil } = await adm.from("perfis").insert({ id: data.user.id, nome: "Duas Etapas E2E", papel: "contador", funcionaria_id: null, ativo: true });
  if (ePerfil) throw ePerfil;
  try {
    const c = await entrar(email, { senha });
    await ir(c, "/conta");
    await c.getByRole("button", { name: "Ligar verificação em duas etapas" }).click();
    const segredo = (await c.locator("[data-segredo]").textContent())!.trim();
    const primeiro = codigoTotp(segredo);
    await c.getByLabel("2. Digite o código de 6 números que o app mostra").fill(primeiro);
    await c.getByRole("button", { name: "Confirmar e ligar" }).click();
    await expect(c.getByText("Ligada: ao entrar, além da senha")).toBeVisible();

    const p = await novaPagina();
    await p.goto("/login");
    await p.fill('input[name="login"]', email);
    await p.fill('input[name="senha"]', senha);
    await p.click('button[type="submit"]');
    await p.waitForURL(/\/login\/codigo/);
    expect((await baixar(p, "/arquivos/recibos")).status, "antes do código, arquivo não abre").toBe(401);
    await p.goto("/rh/semanas");
    await expect(p, "antes do código, tela não abre").toHaveURL(/\/login\/codigo/);
    await p.getByLabel("Código", { exact: true }).fill(primeiro === "000000" ? "111111" : "000000");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(alerta(p)).toHaveText("Código errado ou vencido. Confira no app e tente de novo.");
    await p.getByLabel("Código", { exact: true }).fill(await codigoNovo(segredo, primeiro));
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.waitForURL(/\/rh\/semanas/);

    await ir(p, "/conta");
    await p.getByRole("button", { name: "Desligar verificação em duas etapas" }).click();
    await expect(p.getByRole("button", { name: "Ligar verificação em duas etapas" })).toBeVisible();
    await entrar(email, { senha }); // sem a verificação, a senha basta de novo (o entrar espera sair de /login…)
  } finally {
    await adm.auth.admin.deleteUser(data.user.id);
  }
});
