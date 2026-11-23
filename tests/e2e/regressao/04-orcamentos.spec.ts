/**
 * 0.8 — orçamento do zero: conta do protótipo, salvar sozinho, preço congelado, PDF, envio pelo WhatsApp,
 * a cliente aprova pelo link (a prévia não aprova), desfazer, numeração sem buraco, vencido, acessos e celular.
 */
import type { Page } from "@playwright/test";

import { CELULAR, HOJE_SQL, baixar, expect, ir, linha, semRolagemLateral, test } from "../apoio/teste";

const salvo = (p: Page) => expect(p.getByRole("status").filter({ hasText: /^Salvo às \d\d:\d\d$/ })).toBeVisible({ timeout: 15_000 });
const total = (p: Page) => p.locator("aside").getByText(/^R\$ [\d.]+,\d\d$/).last();
const idDaUrl = (p: Page) => new URL(p.url()).pathname.split("/").pop()!;

test("orçamentos", async ({ entrar, novaPagina, db, request }) => {
  test.setTimeout(5 * 60_000);
  // Banco de teste limpo a cada rodada (orçamentos, numeração e o que o roteiro altera).
  await db.query("delete from recibos"); // o recibo prende o orçamento (on delete restrict)
  await db.query("delete from orcamentos");
  await db.query("delete from clientes where nome = 'Cliente Teste Orçamento'");
  await db.query("update numeracao set proximo = 1 where tipo = 'orcamento'");
  await db.query("update produtos set preco_centavos = 8990 where nome = 'Linho Toscana'");
  await db.query("update regras_orcamento set sobra_trilho_cm = 20, area_minima_persiana_cm2 = 15000"); // o spec de vendas muda

  const g = await entrar("cristina");
  let idOrc = "";

  await test.step("lista vazia → novo orçamento para cliente existente", async () => {
    await ir(g, "/orcamentos");
    await expect.soft(g.getByText("Nenhum orçamento ainda"), "lista vazia explica o primeiro passo").toBeVisible();
    await g.getByRole("button", { name: "Novo orçamento" }).click();
    await g.getByLabel("Buscar cliente").fill("mariana");
    await g.getByRole("button", { name: /Mariana Couto/ }).click();
    await g.waitForURL(/\/orcamentos\/[0-9a-f-]{36}$/);
    await g.waitForLoadState("networkidle");
    idOrc = idDaUrl(g);
    await expect.soft(g.getByRole("heading", { name: "Orçamento nº 0001" }), "numeração começa em 0001").toBeVisible();
    await expect.soft(g.getByLabel("Endereço da obra"), "obra do cadastro vem preenchida").toHaveValue(/^R\. das Hortênsias/);
  });

  await test.step("cortina na sala com a conta do protótipo; salva sozinho", async () => {
    const sala = g.locator("section").nth(0);
    await sala.getByRole("button", { name: "Item neste ambiente" }).click();
    await sala.getByLabel("Tecido").selectOption({ label: "Linho Toscana · R$ 89,90/m" });
    await sala.getByLabel("Confecção").selectOption({ label: "Prega wave · fator 2,5" });
    await sala.getByLabel("Cor").fill("Areia");
    await sala.getByLabel("Largura do vão (cm)").fill("320");
    await sala.getByLabel("Altura do vão (cm)").fill("270");
    await expect.soft(sala.getByText("3,20 m × 2,5 = 8,00 m × R$ 89,90"), "memória de cálculo ao vivo").toBeVisible();
    await expect.soft(sala.getByText("R$ 1.200,40").first(), "tecido + confecção + trilho + instalação").toBeVisible();
    await salvo(g);
    const item = await linha<{ total_centavos: number }>(db, "select total_centavos from orcamento_itens where orcamento_id = $1", [idOrc]);
    expect.soft(item?.total_centavos, "o banco tem o mesmo valor da tela").toBe(120040);
  });

  await test.step("escritório com persiana por m²; desconto e deslocamento", async () => {
    await g.getByRole("button", { name: /Ambiente \(sala, quarto/ }).click();
    const esc = g.locator("section").nth(1);
    await esc.getByLabel("Nome do ambiente").fill("Escritório");
    await esc.getByRole("button", { name: "Item neste ambiente" }).click();
    await esc.getByLabel("Produto", { exact: true }).selectOption("persiana");
    await esc.getByLabel("Modelo").selectOption({ label: "Double vision · R$ 249,00/m²" });
    await esc.getByLabel("Largura do vão (cm)").fill("140");
    await esc.getByLabel("Altura do vão (cm)").fill("160");
    await expect.soft(esc.getByText("1,40 m × 1,60 m = 2,24 m² × R$ 249,00")).toBeVisible();
    await g.getByLabel("Desconto em %").fill("5");
    await g.getByLabel("Taxa de deslocamento").fill("50");
    await salvo(g);
    await expect.soft(total(g), "total com 5% de desconto e deslocamento").toHaveText("R$ 1.777,25");
  });

  await test.step("preço congelado: o catálogo muda e o item não", async () => {
    await db.query("update produtos set preco_centavos = 9990 where nome = 'Linho Toscana'");
    await g.reload();
    await g.waitForLoadState("networkidle");
    await expect.soft(total(g), "depois de recarregar, o total continua o da época").toHaveText("R$ 1.777,25");
    const sala = g.locator("section").nth(0);
    await sala.getByLabel("Largura do vão (cm)").fill("330");
    await salvo(g);
    await expect.soft(sala.getByText("3,30 m × 2,5 = 8,25 m × R$ 89,90"), "mudar a medida mantém o preço congelado").toBeVisible();
    await sala.getByLabel("Largura do vão (cm)").fill("320");
    await salvo(g);
    await db.query("update produtos set preco_centavos = 8990 where nome = 'Linho Toscana'");
  });

  let linkCliente = "";
  await test.step("PDF de rascunho e envio pelo WhatsApp", async () => {
    expect.soft(await baixar(g, `/arquivos/orcamento/${idOrc}`), "PDF de pré-visualização").toEqual({ status: 200, tipo: "application/pdf" });
    await g.getByRole("button", { name: "Enviar ao cliente" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(g.getByText("Orçamento enviado")).toBeVisible();
    const whats = (await g.getByRole("link", { name: "Abrir o WhatsApp" }).getAttribute("href")) ?? "";
    linkCliente = (await g.getByLabel("Mensagem para a cliente").inputValue()).match(/https?:\/\/\S+\/o\/[0-9a-f-]{36}/)?.[0] ?? "";
    expect.soft(whats.startsWith("https://wa.me/5519991342280?text="), "WhatsApp com o telefone da cliente").toBe(true);
    expect(linkCliente, "mensagem com o link do orçamento").not.toBe("");
    await g.keyboard.press("Escape");
    await expect(g.getByText(/^Enviado em .* válido até/)).toBeVisible();
    await expect.soft(g.getByLabel("Largura do vão (cm)").first(), "enviado: o conteúdo trava").toBeDisabled();
    const o = await linha<{ status: string; dias: number }>(db, `select status, valido_ate - ${HOJE_SQL} as dias from orcamentos where id = $1`, [idOrc]);
    expect.soft(o?.status).toBe("enviado");
    expect.soft(o?.dias, "validade de 30 dias").toBeGreaterThanOrEqual(29);
  });

  const cli = await novaPagina(CELULAR);
  await test.step("a cliente abre o link (a prévia do WhatsApp também) e aprova", async () => {
    for (let i = 0; i < 2; i++) await request.get(linkCliente);
    expect.soft((await linha<{ status: string }>(db, "select status from orcamentos where id = $1", [idOrc]))?.status, "abrir o link não aprova").toBe("enviado");
    await ir(cli, linkCliente);
    await expect.soft(cli.getByRole("heading", { name: "Olá, Mariana!" }), "página da cliente sem login").toBeVisible();
    await expect.soft(cli.getByText("R$ 1.777,25").first()).toBeVisible();
    expect.soft(await cli.content(), "a cliente não vê nada interno").not.toContain("Observações internas");
    expect.soft(await semRolagemLateral(cli), "página da cliente sem rolagem lateral").toBe(true);
    expect.soft((await cli.request.get(`${linkCliente}/pdf`)).status(), "a cliente baixa o PDF pelo link").toBe(200);
    await cli.getByRole("button", { name: "Aprovar orçamento" }).click();
    await cli.getByRole("dialog").getByRole("button", { name: "Sim, aprovar" }).click();
    await expect(cli.getByText(/^Aprovado em/)).toBeVisible();
    const o = await linha<{ status: string; aprovado_pelo_link: boolean }>(db, "select status, aprovado_pelo_link from orcamentos where id = $1", [idOrc]);
    expect.soft(o).toEqual({ status: "aprovado", aprovado_pelo_link: true });
  });

  await test.step("a gestora desfaz e volta a editar → o link deixa de mostrar", async () => {
    await g.reload();
    await g.waitForLoadState("networkidle");
    await expect.soft(g.getByText(/Aprovado pela cliente, pelo link,/)).toBeVisible();
    await g.getByRole("button", { name: "Desfazer aprovação" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Desfazer aprovação" }).click();
    await expect(g.getByText(/de volta para rascunho|Orçamento enviado|Enviado em/).first()).toBeVisible();
    await g.waitForLoadState("networkidle");
    await g.getByRole("button", { name: "Voltar a editar" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Voltar a editar" }).click();
    await expect(g.getByText("Orçamento de volta para rascunho")).toBeVisible();
    await cli.reload();
    await expect.soft(cli.getByText("Orçamento não encontrado"), "rascunho: o link não mostra").toBeVisible();
  });

  let id122 = "";
  await test.step("numeração: descarte não abre buraco; o próximo número só anda para frente", async () => {
    await ir(g, "/orcamentos");
    await g.getByRole("button", { name: "Novo orçamento" }).click();
    await g.getByRole("button", { name: "Cliente novo" }).click();
    await g.getByRole("dialog").getByRole("textbox").nth(0).fill("Cliente Teste Orçamento");
    await g.getByRole("dialog").getByRole("textbox").nth(1).fill("(19) 98888-1111");
    await g.getByRole("button", { name: "Cadastrar e abrir o orçamento" }).click();
    await g.waitForURL(/\/orcamentos\/[0-9a-f-]{36}$/);
    await g.waitForLoadState("networkidle");
    await expect.soft(g.getByRole("heading", { name: "Orçamento nº 0002" }), "cadastro rápido já abre o 0002").toBeVisible();
    await g.getByRole("button", { name: "Descartar" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Descartar" }).click();
    await expect(g.getByText("Rascunho descartado").first()).toBeVisible();
    await ir(g, "/configuracoes");
    await g.getByLabel("Próximo orçamento").fill("1");
    await g.getByRole("button", { name: "Salvar padrões" }).click();
    await expect(g.getByText(/precisa ser maior que 0002/), "o número não volta para trás").toBeVisible();
    await g.getByLabel("Próximo orçamento").fill("122");
    await g.getByRole("button", { name: "Salvar padrões" }).click();
    await expect(g.getByText("Numeração e padrões salvos")).toBeVisible();
    await ir(g, "/clientes");
    await g.getByRole("link", { name: /Clínica Viver Bem/ }).click();
    await g.waitForLoadState("networkidle");
    await g.getByRole("button", { name: "Orçamento", exact: true }).click();
    await g.waitForURL(/\/orcamentos\/[0-9a-f-]{36}$/);
    await g.waitForLoadState("networkidle");
    await expect.soft(g.getByRole("heading", { name: "Orçamento nº 0122" }), "continua a numeração da loja, aberto pela ficha").toBeVisible();
    id122 = idDaUrl(g);
    await g.locator("section").nth(0).getByRole("button", { name: "Item neste ambiente" }).click();
    await g.locator("section").nth(0).getByLabel("Produto", { exact: true }).selectOption("servico");
    await salvo(g);
    await g.getByRole("button", { name: "Enviar ao cliente" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(g.getByText("Orçamento enviado")).toBeVisible();
    await g.keyboard.press("Escape");
  });

  await test.step("vencido: lista e link avisam; a cliente não aprova mais", async () => {
    // A validade passa (o trigger trava o conteúdo fora do rascunho: ajuste direto, sem trigger).
    await db.query("begin");
    await db.query("set local session_replication_role = replica");
    await db.query(`update orcamentos set valido_ate = ${HOJE_SQL} - 1 where id = $1`, [id122]);
    await db.query("commit");
    await ir(g, "/orcamentos?s=vencido");
    await expect.soft(g.getByRole("link", { name: /0122/ }), "filtro Vencido").toBeVisible();
    const { token } = (await linha<{ token: string }>(db, "select token from orcamentos where id = $1", [id122]))!;
    await ir(cli, `/o/${token}`);
    await expect.soft(cli.getByText(/Este orçamento venceu em/)).toBeVisible();
    await expect.soft(cli.getByRole("button", { name: "Aprovar orçamento" }), "vencido não deixa aprovar").toHaveCount(0);
    await ir(g, "/orcamentos");
    await g.getByLabel("Buscar orçamento").fill("0122");
    await g.getByRole("button", { name: "Filtrar" }).click();
    await g.waitForLoadState("networkidle");
    await expect.soft(g.locator('a[href^="/orcamentos/"]'), "busca pelo número").toHaveCount(1);
    await ir(g, "/inicio");
    await expect.soft(g.getByText(/1 vencido sem resposta/), "Início avisa do vencido").toBeVisible();

    // Decisão de 25/10/2026: 30 dias depois de vencer, o link expira e não mostra mais os dados da cliente.
    await db.query("begin");
    await db.query("set local session_replication_role = replica");
    await db.query(`update orcamentos set valido_ate = ${HOJE_SQL} - 31 where id = $1`, [id122]);
    await db.query("commit");
    await ir(cli, `/o/${token}`);
    await expect.soft(cli.getByRole("heading", { name: "Este link expirou" })).toBeVisible();
    await expect.soft(cli.getByText("Clínica Viver Bem"), "nada da cliente na página expirada").toHaveCount(0);
    expect.soft((await cli.request.get(`/o/${token}/pdf`)).status(), "o PDF também expira").toBe(404);
  });

  await test.step("acessos e celular", async () => {
    const c = await entrar("contador");
    await c.goto("/orcamentos");
    await expect.soft(c, "contador não entra em orçamentos").toHaveURL(/\/sem-permissao/);
    expect.soft((await baixar(c, `/arquivos/orcamento/${idOrc}`)).status, "contador não baixa o PDF").toBe(403);
    const anon = await novaPagina();
    await anon.goto("/orcamentos");
    await expect.soft(anon, "sem login vai para o login").toHaveURL(/\/login/);
    const gc = await entrar("cristina", { viewport: CELULAR });
    await ir(gc, `/orcamentos/${idOrc}`);
    expect.soft(await semRolagemLateral(gc), "editor sem rolagem lateral no celular").toBe(true);
    await expect.soft(gc.getByRole("link", { name: /Ver resumo e enviar/ }), "total fixo no rodapé do celular").toBeVisible();
    await gc.locator("section").nth(0).getByLabel("Largura do vão (cm)").fill("300");
    await salvo(gc);
  });
});
