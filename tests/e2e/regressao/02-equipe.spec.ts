/**
 * 0.6 — cadastrar funcionária → criar acesso → link pelo "WhatsApp" (a prévia não gasta o link) → ela cria a
 * senha e troca o nome → a gestora vê, redefine, bloqueia, desliga → calendário, regras, empresa, convite de
 * contador, Minha conta.
 */
import type { Page } from "@playwright/test";

import { BASE } from "../apoio/ambiente";
import { CELULAR, expect, ir, linha, semRolagemLateral, test } from "../apoio/teste";

const SENHA = "SenhaNova2026";
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const linhaEquipe = (p: Page, texto: string) => p.locator("div.grid", { hasText: texto }).filter({ has: p.getByRole("button", { name: "Editar" }) }).first();
async function linkDoDialogo(p: Page) {
  const texto = await p.getByLabel("Mensagem com o link").inputValue();
  const whats = (await p.getByRole("link", { name: "Enviar pelo WhatsApp" }).getAttribute("href")) ?? "";
  return { texto, link: texto.split("\n").at(-1) ?? "", whats };
}

test("equipe, acessos e regras", async ({ entrar, novaPagina, db, request }, info) => {
  test.setTimeout(5 * 60_000);
  // Restos de uma rodada anterior que parou no meio (com E2E_SEM_ZERAR=1).
  await db.query("delete from auth.users where email in ('teste.e2e@usuarios.cristinas.invalid', 'contab.teste@exemplo.com')");
  await db.query("delete from funcionarias where nome = 'Teste Ponta a Ponta'");
  await db.query("update perfis set nome = 'Contabilidade (dev)' where nome = 'Contabilidade Silva'");
  await db.query("update empresa set cnpj = ''");

  const g = await entrar("cristina");
  await test.step("gestora cadastra a funcionária com jornada própria", async () => {
    await ir(g, "/ponto/equipe");
    await g.getByRole("button", { name: "Nova funcionária" }).click();
    const dialogo = g.getByRole("dialog");
    await dialogo.getByRole("textbox").nth(0).fill("Teste Ponta a Ponta");
    await dialogo.getByRole("textbox").nth(1).fill("Teste E2E");
    await dialogo.getByRole("textbox").nth(2).fill("999");
    await g.getByLabel("Jornada própria").check();
    await g.getByPlaceholder("HH:MM").nth(0).fill("0800");
    await g.getByPlaceholder("HH:MM").nth(1).fill("0700");
    await g.getByRole("button", { name: "Cadastrar" }).click();
    await expect(g.getByText("Funcionária cadastrada")).toBeVisible();
    const l = linhaEquipe(g, "Teste E2E");
    await expect(l).toBeVisible();
    await expect.soft(l.getByText("Seg–Qui 08:00")).toBeVisible();
    await expect.soft(l.getByText("Sex 07:00")).toBeVisible();
    await expect.soft(l.getByText("jornada própria")).toBeVisible();
    await expect.soft(l.getByText("999", { exact: true }), "ID da catraca sem os zeros").toBeVisible();
  });

  let convite = { texto: "", link: "", whats: "" };
  await test.step("cria o acesso e gera o link", async () => {
    await linhaEquipe(g, "Teste E2E").getByRole("button", { name: "Criar acesso" }).click();
    await expect.soft(g.getByRole("dialog").getByRole("textbox"), "usuário sugerido a partir do nome").toHaveValue("teste.e");
    await g.getByRole("dialog").getByRole("textbox").fill("teste.e2e");
    await g.getByRole("button", { name: "Criar e gerar link" }).click();
    await expect(g.getByText("Acesso criado")).toBeVisible();
    convite = await linkDoDialogo(g);
    expect.soft(convite.texto).toContain("Seu usuário: teste.e2e");
    expect.soft(convite.link.startsWith(`${BASE}/auth/confirmar?token_hash=`), `link do convite: ${convite.link}`).toBe(true);
    expect.soft(convite.whats.startsWith("https://wa.me/?text="), "botão do WhatsApp com a mensagem").toBe(true);
    await g.keyboard.press("Escape");
    await g.reload();
    await expect.soft(linhaEquipe(g, "Teste E2E").getByText("Convite enviado")).toBeVisible();
  });

  const f = await novaPagina(CELULAR);
  await test.step("a prévia do WhatsApp não gasta o link; ela cria a senha", async () => {
    for (let i = 1; i <= 2; i++) expect.soft((await request.get(convite.link)).status(), `prévia #${i} do link`).toBe(200);
    await ir(f, convite.link);
    expect.soft(await semRolagemLateral(f), "Criar senha: sem rolagem lateral").toBe(true);
    await f.getByLabel("Senha nova").fill("curta1");
    await expect.soft(f.getByRole("button", { name: "Salvar senha" }), "senha fraca não deixa salvar").toBeDisabled();
    await f.getByLabel("Senha nova").fill(SENHA);
    await f.getByLabel("Repita a senha").fill(SENHA);
    await f.getByRole("button", { name: "Salvar senha" }).click();
    await f.waitForURL(/\/meu-ponto/);
    await expect.soft(f.getByText("Teste E2E").first(), "portal mostra o nome do cadastro").toBeVisible();
  });

  await test.step("ela troca o próprio nome", async () => {
    await f.getByRole("link", { name: /Meu perfil/ }).click();
    await f.waitForURL(/\/meu-ponto\/perfil/);
    await f.getByRole("textbox").fill("Testinha");
    await f.getByRole("button", { name: "Salvar nome" }).click();
    await expect(f.getByText("Nome atualizado")).toBeVisible();
    await expect.soft(f.locator("header").getByText("Testinha"), "cabeçalho com o nome novo").toBeVisible();
    expect.soft(await semRolagemLateral(f), "Meu perfil: sem rolagem lateral").toBe(true);
  });

  await test.step("a gestora vê o nome escolhido e não consegue mudá-lo", async () => {
    await g.reload();
    const l = linhaEquipe(g, "Testinha");
    await expect.soft(l.getByText("Ativo")).toBeVisible();
    await l.getByRole("button", { name: "Editar" }).click();
    await expect.soft(g.getByRole("dialog").getByRole("textbox").nth(1), "nome de exibição travado para a gestora").toBeDisabled();
    await g.keyboard.press("Escape");
  });

  await test.step("redefinir senha: o link novo vale, o antigo não", async () => {
    await linhaEquipe(g, "Testinha").getByRole("button", { name: "Redefinir senha" }).click();
    await expect(g.getByText("Link novo gerado")).toBeVisible();
    expect.soft((await linkDoDialogo(g)).texto).toContain("criar uma senha nova");
    await g.keyboard.press("Escape");
    const velho = await novaPagina(CELULAR);
    await ir(velho, convite.link);
    await velho.getByLabel("Senha nova").fill("OutraSenha1");
    await velho.getByLabel("Repita a senha").fill("OutraSenha1");
    await velho.getByRole("button", { name: "Salvar senha" }).click();
    await expect(velho.getByText("Este link venceu ou já foi usado")).toBeVisible();
  });

  await test.step("bloquear e desbloquear", async () => {
    await linhaEquipe(g, "Testinha").getByRole("button", { name: "Bloquear" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Bloquear" }).click();
    await expect(g.getByText("Acesso bloqueado")).toBeVisible();
    await f.goto("/meu-ponto");
    await expect.soft(f, "bloqueada sai do portal").toHaveURL(/\/login/);
    await f.fill('input[name="login"]', "teste.e2e");
    await f.fill('input[name="senha"]', SENHA);
    await f.click('button[type="submit"]');
    await expect(f.getByText("Seu acesso está bloqueado")).toBeVisible();
    await g.reload();
    await linhaEquipe(g, "Testinha").getByRole("button", { name: "Desbloquear" }).click();
    await expect(g.getByText("Acesso desbloqueado")).toBeVisible();
    // O formulário com server action limpa os campos depois do envio: preenche de novo.
    await f.fill('input[name="login"]', "teste.e2e");
    await f.fill('input[name="senha"]', SENHA);
    await f.click('button[type="submit"]');
    await f.waitForURL(/\/meu-ponto/);
  });

  await test.step("desligar: sai da lista e o acesso fica bloqueado", async () => {
    await g.reload();
    await linhaEquipe(g, "Testinha").getByRole("button", { name: "Editar" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Desligar" }).click();
    await g.getByRole("alertdialog").or(g.getByRole("dialog").last()).getByRole("button", { name: "Desligar" }).last().click();
    await expect(g.getByText(/Funcionária desligada · acesso bloqueado/)).toBeVisible();
    await g.reload();
    await expect.soft(linhaEquipe(g, "Testinha"), "desligada sai da lista principal").toBeHidden();
    await g.getByText(/Desligadas \(\d+\)/).click();
    await expect.soft(linhaEquipe(g, "Testinha").getByText("Bloqueado")).toBeVisible();
  });

  await test.step("calendário: feriado de semana aberta entra e sai; o de semana fechada fica travado", async () => {
    await ir(g, "/ponto/calendario?ano=2026");
    await g.getByLabel("Data", { exact: true }).fill("2026-11-13");
    await g.getByPlaceholder("Ex.: Aniversário da cidade").fill("Feriado de teste");
    await g.getByRole("button", { name: "Adicionar" }).click();
    await expect(g.getByText("Feriado em 13/11/2026 cadastrado")).toBeVisible();
    const travado = await linha<{ nome: string }>(
      db,
      `select f.nome from feriados f join semanas s on s.segunda = public.segunda_de(f.data) and s.status = 'fechada'
        where extract(year from f.data) = 2026 order by f.data limit 1`,
    );
    if (travado) await expect.soft(g.getByRole("button", { name: `Remover ${travado.nome}` }), "feriado de semana fechada não sai").toBeDisabled();
    else info.annotations.push({ type: "pulado", description: "banco de teste sem semana fechada: feriado travado não conferido" });
    await g.getByRole("button", { name: "Remover Feriado de teste" }).click();
    await expect(g.getByText("Feriado de 13/11/2026 removido")).toBeVisible();
  });

  await test.step("regras: valem a partir da primeira semana não fechada, sem mexer nas versões antigas", async () => {
    const versoes = async () => (await db.query("select vigente_desde::text d, tolerancia_atraso_min t from regras_ponto order by vigente_desde")).rows;
    const antes = await versoes();
    const { d: desde } = (await linha<{ d: string }>(
      db,
      "select coalesce((select max(segunda) + 7 from semanas where status = 'fechada'), (select min(vigente_desde) from regras_ponto))::text d",
    ))!;
    await g.getByRole("textbox", { name: "Tolerância de atraso" }).fill("15");
    await g.getByRole("button", { name: "Salvar regras" }).click();
    await expect(g.getByText(`Regras salvas · valem a partir da semana de ${dataBR(desde)}`)).toBeVisible();
    const depois = await versoes();
    expect.soft(depois.at(-1)).toEqual({ d: desde, t: 15 });
    expect.soft(depois.slice(0, -1), "versões anteriores intactas").toEqual(antes.filter((r) => r.d < desde));
  });

  await test.step("dados da empresa: CNPJ validado", async () => {
    await ir(g, "/configuracoes");
    await g.getByLabel("CNPJ").fill("123");
    await g.getByRole("button", { name: "Salvar dados da empresa" }).click();
    await expect(g.getByText("CNPJ com 14 dígitos.")).toBeVisible();
    await g.getByLabel("CNPJ").fill("12.345.678/0001-90");
    await g.getByRole("button", { name: "Salvar dados da empresa" }).click();
    await expect(g.getByText("Dados da empresa salvos")).toBeVisible();
  });

  await test.step("convidar contador", async () => {
    await g.getByRole("button", { name: "Convidar" }).click();
    await g.getByRole("dialog").getByRole("textbox").nth(0).fill("Escritório de Teste");
    await g.getByRole("dialog").getByRole("textbox").nth(1).fill("contab.teste@exemplo.com");
    await g.getByRole("button", { name: "Criar e gerar link" }).click();
    await expect(g.getByText("Acesso criado")).toBeVisible();
    await g.keyboard.press("Escape");
    await g.reload();
    await expect.soft(g.getByText("contab.teste@exemplo.com"), "contador convidado aparece em usuários").toBeVisible();
    const minhaLinha = g.locator("div.border-b.flex-col").filter({ hasText: "Gestora" }).filter({ hasText: "cristina" });
    await expect.soft(minhaLinha).toHaveCount(1);
    await expect.soft(minhaLinha.getByRole("button", { name: "Bloquear" }), "gestora não bloqueia a si mesma").toHaveCount(0);
  });

  await test.step("contador: sem Configurações; troca o próprio nome em Minha conta", async () => {
    const c = await entrar("contador");
    await c.goto("/configuracoes");
    await expect.soft(c).toHaveURL(/\/sem-permissao/);
    await ir(c, "/conta");
    await c.getByRole("textbox").fill("Contabilidade Silva");
    await c.getByRole("button", { name: "Salvar nome" }).click();
    await expect(c.getByText("Nome atualizado")).toBeVisible();
    await expect.soft(c.getByText("Contabilidade Silva").first()).toBeVisible();
  });
});
