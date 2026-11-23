/**
 * 0.7 — clientes (busca, cadastro, ficha, edição, exclusão) e catálogo (preço em reais, ativo/inativo,
 * modelos de confecção, regras de cálculo), com os acessos por papel e o celular.
 */
import type { Page } from "@playwright/test";

import { CELULAR, expect, ir, loginDaCatraca, semRolagemLateral, test } from "../apoio/teste";

const painel = (p: Page) => p.getByRole("dialog");
const campo = (p: Page, rotulo: string) => painel(p).getByLabel(rotulo, { exact: true });
const linhaDoCatalogo = (p: Page, nome: string) => p.locator("div", { has: p.getByText(nome, { exact: true }) }).filter({ has: p.getByRole("switch") }).last();

test("clientes e catálogo", async ({ entrar, db }) => {
  test.setTimeout(5 * 60_000);
  // Restos de rodada anterior (com E2E_SEM_ZERAR=1) e regras no padrão do seed.
  await db.query("delete from clientes where nome like '%E2E%'");
  await db.query("delete from produtos where nome like '%E2E%'");
  await db.query("delete from modelos_confeccao where nome like '%E2E%'");
  await db.query("update regras_orcamento set sobra_trilho_cm = 20, area_minima_persiana_cm2 = 15000");

  const g = await entrar("cristina");
  const linhas = g.locator('a[href^="/clientes/"]');
  let iniciais = 0;

  await test.step("lista e busca sem acento e por telefone", async () => {
    await ir(g, "/clientes");
    iniciais = await linhas.count();
    expect.soft(iniciais, "clientes de exemplo na lista").toBeGreaterThanOrEqual(3);
    await g.getByLabel("Buscar cliente").fill("barao");
    await expect.soft(linhas, "busca ignora acento (barao → Barão Geraldo)").toHaveCount(1);
    await expect.soft(linhas.first()).toContainText("Juliana Prado");
    await g.getByLabel("Buscar cliente").fill("3251");
    await expect.soft(linhas, "busca pelos dígitos do telefone").toHaveCount(1);
    await expect.soft(linhas.first()).toContainText("Clínica Viver Bem");
    await g.getByLabel("Buscar cliente").fill("");
  });

  await test.step("cadastro com obra em outro endereço abre a ficha", async () => {
    await g.getByRole("button", { name: "Cliente", exact: true }).click();
    await campo(g, "Nome").fill("Cliente Teste E2E");
    await campo(g, "WhatsApp / telefone").fill("(19) 98888-7777");
    await campo(g, "CPF ou CNPJ (opcional)").fill("312.448.920-17");
    await campo(g, "Endereço").fill("R. Teste, 10");
    await campo(g, "Bairro").first().fill("Centro");
    await campo(g, "Cidade / UF").first().fill("Campinas/SP");
    await painel(g).getByLabel("A obra é na residência").uncheck();
    await painel(g).getByRole("button", { name: "Cadastrar cliente" }).click();
    await expect(g.getByText("Informe o endereço da obra")).toBeVisible();
    await campo(g, "Endereço da obra").fill("R. das Obras, 99");
    await painel(g).getByRole("button", { name: "Cadastrar cliente" }).click();
    await g.waitForURL(/\/clientes\/[0-9a-f-]{36}$/);
    await g.waitForLoadState("networkidle");
    await expect.soft(g.getByRole("heading", { name: "Cliente Teste E2E" })).toBeVisible();
    await expect.soft(g.getByRole("link", { name: "Abrir conversa" }), "WhatsApp com 55 + DDD").toHaveAttribute("href", "https://wa.me/5519988887777");
    await expect.soft(g.getByText("312.448.920-17"), "CPF formatado").toBeVisible();
    await expect.soft(g.getByText("R. das Obras, 99")).toBeVisible();
  });

  await test.step("edição: documento inválido recusado; a obra volta para a residência", async () => {
    await g.getByRole("button", { name: "Editar" }).click();
    await campo(g, "CPF ou CNPJ (opcional)").fill("123");
    await painel(g).getByRole("button", { name: "Salvar" }).click();
    await expect(g.getByText("CPF com 11 dígitos ou CNPJ com 14.")).toBeVisible();
    await campo(g, "CPF ou CNPJ (opcional)").fill("12.345.678/0001-90");
    await painel(g).getByLabel("A obra é na residência").check();
    await painel(g).getByRole("button", { name: "Salvar" }).click();
    await expect(g.getByText("Cliente atualizado")).toBeVisible();
    await expect(g.getByText("12.345.678/0001-90")).toBeVisible();
    await expect.soft(g.getByText("CNPJ", { exact: true })).toBeVisible();
    await expect.soft(g.getByText("Na residência", { exact: true })).toBeVisible();
  });

  await test.step("exclusão", async () => {
    await g.getByRole("button", { name: "Excluir" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
    await g.waitForURL(/\/clientes$/);
    await g.waitForLoadState("networkidle");
    await expect.soft(linhas, "cliente excluído some da lista").toHaveCount(iniciais);
  });

  await test.step("catálogo de tecidos: preço com milhar, inativar, nome repetido", async () => {
    await ir(g, "/catalogo");
    await expect.soft(g.getByText(/prega americana 2,5/), "regra do tecido mostra os fatores dos modelos").toBeVisible();
    await g.getByRole("button", { name: "Produto", exact: true }).click();
    await campo(g, "Nome").fill("Tecido Teste E2E");
    await painel(g).getByLabel(/^Preço por metro/).fill("99,90");
    await painel(g).getByLabel(/^Largura do rolo/).fill("2,80");
    await painel(g).getByRole("button", { name: "Cadastrar" }).click();
    await expect(g.getByText("Produto cadastrado")).toBeVisible();
    const tecido = linhaDoCatalogo(g, "Tecido Teste E2E");
    await expect.soft(tecido).toContainText("R$ 99,90");
    await expect.soft(tecido).toContainText("2,80 m");
    await tecido.getByRole("button", { name: "Editar Tecido Teste E2E" }).click();
    await painel(g).getByLabel(/^Preço por metro/).fill("1.234,50");
    await painel(g).getByRole("button", { name: "Salvar" }).click();
    await expect(g.getByText("Produto atualizado")).toBeVisible();
    await expect.soft(tecido, "preço com milhar sem perder centavo").toContainText("R$ 1.234,50");
    await tecido.getByRole("switch").click();
    await expect(g.getByText(/Tecido Teste E2E: inativo/)).toBeVisible();
    await expect.soft(tecido.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    await g.getByRole("button", { name: "Produto", exact: true }).click();
    await campo(g, "Nome").fill("  tecido teste e2e ");
    await painel(g).getByLabel(/^Preço por metro/).fill("10");
    await painel(g).getByRole("button", { name: "Cadastrar" }).click();
    await expect(g.getByText("Já existe um produto com esse nome nesta categoria."), "nome repetido (ignora maiúscula e espaço)").toBeVisible();
    await g.keyboard.press("Escape");
  });

  await test.step("modelo de confecção entra na regra do tecido", async () => {
    await g.getByRole("button", { name: "Modelo", exact: true }).click();
    await campo(g, "Nome").fill("Prega E2E");
    await painel(g).getByLabel("Fator de franzimento").fill("5");
    await painel(g).getByLabel("Confecção por metro de tecido").fill("30,00");
    await painel(g).getByRole("button", { name: "Cadastrar" }).click();
    await expect(g.getByText("Fator de franzimento entre 1,0 e 4,0")).toBeVisible();
    await painel(g).getByLabel("Fator de franzimento").fill("2,2");
    await painel(g).getByRole("button", { name: "Cadastrar" }).click();
    await expect(g.getByText("Modelo cadastrado")).toBeVisible();
    await expect.soft(g.getByText(/prega e2e 2,2/)).toBeVisible();
  });

  await test.step("regras de cálculo: persiana e trilho", async () => {
    await ir(g, "/catalogo?cat=persiana");
    await expect.soft(g.getByText(/área mínima cobrada de 1,50 m²/)).toBeVisible();
    await g.getByRole("button", { name: "Ajustar regras" }).click();
    await g.getByRole("dialog").getByLabel("Sobra do trilho (m)").fill("0,25");
    await g.getByRole("dialog").getByLabel("Área mínima da persiana (m²)").fill("1,20");
    await g.getByRole("dialog").getByRole("button", { name: "Salvar regras" }).click();
    await expect(g.getByText("Regras de cálculo salvas")).toBeVisible();
    await expect.soft(g.getByText(/área mínima cobrada de 1,20 m²/)).toBeVisible();
    await ir(g, "/catalogo?cat=trilho");
    await expect.soft(g.getByText(/0,25 m de sobra/)).toBeVisible();
  });

  await test.step("serviço cobrado por unidade; o banco guarda centavos inteiros", async () => {
    await ir(g, "/catalogo?cat=servico");
    await g.getByRole("button", { name: "Produto", exact: true }).click();
    await campo(g, "Nome").fill("Serviço E2E");
    await painel(g).getByLabel(/^Unidade/).check();
    await painel(g).getByLabel(/^Preço por unidade/).fill("45");
    await painel(g).getByRole("button", { name: "Cadastrar" }).click();
    await expect(g.getByText("Produto cadastrado")).toBeVisible();
    const servico = linhaDoCatalogo(g, "Serviço E2E");
    await expect.soft(servico).toContainText("unidade");
    await expect.soft(servico).toContainText("R$ 45,00");
    const { rows } = await db.query("select nome, preco_centavos, unidade from produtos where nome in ('Tecido Teste E2E', 'Serviço E2E') order by nome");
    expect.soft(rows).toEqual([
      { nome: "Serviço E2E", preco_centavos: 4500, unidade: "un" },
      { nome: "Tecido Teste E2E", preco_centavos: 123450, unidade: "m" },
    ]);
  });

  await test.step("acessos e celular", async () => {
    const c = await entrar("contador");
    for (const rota of ["/clientes", "/catalogo"]) {
      await c.goto(rota);
      await expect.soft(c, `contador não entra em ${rota}`).toHaveURL(/\/sem-permissao/);
    }
    const f = await entrar(await loginDaCatraca(db, "000000005"), { viewport: CELULAR });
    await f.goto("/clientes");
    await expect.soft(f, "funcionária não entra em clientes").not.toHaveURL(/\/clientes/);
    const gc = await entrar("cristina", { viewport: CELULAR });
    for (const rota of ["/clientes", "/catalogo", "/catalogo?cat=tecido"]) {
      await ir(gc, rota);
      expect.soft(await semRolagemLateral(gc), `celular sem rolagem lateral em ${rota}`).toBe(true);
    }
  });
});
