/**
 * 0.9 — do orçamento aprovado ao sinal e à quitação (só o saldo exato), cancelar devolve o saldo, avulso,
 * lista/filtros/exportação, ficha do cliente, contador só lê, numeração do talão e celular.
 */
import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { CELULAR, baixar, expect, ir, linha, loginDaCatraca, semRolagemLateral, test } from "../apoio/teste";

const valor = (p: Page) => p.getByLabel("Valor recebido");
const emitir = (p: Page) => p.getByRole("button", { name: /^Emitir recibo de/ });

test("recibos", async ({ entrar, db }) => {
  test.setTimeout(5 * 60_000);

  // Preparo: orçamento aprovado de R$ 1.777,65 para uma cliente só deste spec.
  await db.query("delete from recibos");
  await db.query("update numeracao set proximo = 1 where tipo = 'recibo'");
  await db.query("delete from orcamentos where cliente_id in (select id from clientes where nome = 'Cliente Recibo E2E')");
  await db.query("delete from clientes where nome = 'Cliente Recibo E2E'");
  const cli = (await linha<{ id: string }>(db, "insert into clientes (nome, telefone) values ('Cliente Recibo E2E', '(19) 97777-0000') returning id"))!.id;
  const orc = (await linha<{ id: string; numero: number }>(db, "insert into orcamentos (cliente_id) values ($1) returning id, numero", [cli]))!;
  const amb = randomUUID();
  await db.query("insert into orcamento_ambientes (id, orcamento_id, ordem, nome) values ($1, $2, 0, 'Sala')", [amb, orc.id]);
  await db.query(
    `insert into orcamento_itens (id, orcamento_id, ambiente_id, ordem, tipo, quantidade, precos, linhas, descricao, unitario_centavos, total_centavos)
     values ($1, $2, $3, 0, 'servico', 1, '{}', '[]', 'Cortinas da sala', 177765, 177765)`,
    [randomUUID(), orc.id, amb],
  );
  await db.query("update orcamentos set subtotal_centavos = 177765, total_centavos = 177765 where id = $1", [orc.id]);
  await db.query("update orcamentos set status = 'enviado' where id = $1", [orc.id]);
  await db.query("update orcamentos set status = 'aprovado' where id = $1", [orc.id]);
  const N = String(orc.numero).padStart(4, "0");

  const g = await entrar("cristina");
  let idSinal = "";

  await test.step("do orçamento aprovado para o sinal", async () => {
    await ir(g, `/orcamentos/${orc.id}`);
    await expect.soft(g.getByText("Recebimentos")).toBeVisible();
    await g.getByRole("link", { name: "Emitir recibo" }).click();
    await g.waitForURL(/\/recibos\/novo\?orcamento=/);
    await g.waitForLoadState("networkidle");
    await expect.soft(valor(g), "sinal sugerido = metade do total").toHaveValue("888,83");
    await expect
      .soft(
        g.getByText(
          `Recebi de Cliente Recibo E2E a importância de oitocentos e oitenta e oito reais e oitenta e três centavos, referente ao sinal do orçamento nº ${N} (Sala).`,
        ),
        "prévia com valor por extenso e referente",
      )
      .toBeVisible();
    await valor(g).fill("2.000,00");
    await expect.soft(g.getByText(/Maior que o saldo do orçamento/)).toBeVisible();
    await expect.soft(emitir(g), "acima do saldo não emite").toBeDisabled();
    await valor(g).fill("888,83");
    await emitir(g).click();
    await g.waitForURL(/\/recibos\/[0-9a-f-]{36}\?vias=2$/);
    await g.waitForLoadState("networkidle");
    idSinal = new URL(g.url()).pathname.split("/").pop()!;
    await expect.soft(g.getByRole("heading", { name: "Recibo nº 0001" })).toBeVisible();
    expect.soft(await baixar(g, `/arquivos/recibo/${idSinal}?vias=2`), "PDF em duas vias").toEqual({ status: 200, tipo: "application/pdf" });
  });

  await test.step("quitação: só o saldo exato", async () => {
    await ir(g, `/recibos/novo?orcamento=${orc.id}`);
    await expect.soft(g.getByRole("radio", { name: "Quitação" }), "com pagamento anterior, sugere quitação").toHaveAttribute("aria-checked", "true");
    await expect.soft(valor(g)).toHaveValue("888,82");
    await expect.soft(g.getByText("✓ Quita o orçamento.")).toBeVisible();
    await valor(g).fill("800");
    await expect.soft(g.getByText("Quitação é o saldo inteiro: R$ 888,82.")).toBeVisible();
    await expect.soft(emitir(g), "quitação diferente do saldo não emite").toBeDisabled();
    await valor(g).fill("888,82");
    await g.getByLabel("Forma de pagamento").selectOption("dinheiro");
    await emitir(g).click();
    await g.waitForURL(/\/recibos\/[0-9a-f-]{36}/);
    await g.waitForLoadState("networkidle");
    await expect.soft(g.getByRole("heading", { name: "Recibo nº 0002" })).toBeVisible();
    await ir(g, `/orcamentos/${orc.id}`);
    await expect.soft(g.getByText("Quitado").first()).toBeVisible();
    await expect.soft(g.getByRole("button", { name: "Desfazer aprovação" }), "com recibo emitido não desfaz a aprovação").toHaveCount(0);
    await ir(g, "/orcamentos?s=aprovado");
    await expect.soft(g.getByText("Quitado").first(), "a lista de orçamentos mostra o pagamento").toBeVisible();
  });

  await test.step("cancelar o sinal devolve o saldo", async () => {
    await ir(g, "/recibos");
    await g.locator("div", { has: g.getByRole("link", { name: "0001", exact: true }) }).getByRole("button", { name: "Cancelar" }).last().click();
    await g.getByLabel("Motivo do cancelamento").fill("Valor lançado em duplicidade");
    await g.getByRole("dialog").getByRole("button", { name: "Cancelar recibo" }).click();
    await expect(g.getByText(/Recibo nº 0001 cancelado/)).toBeVisible();
    const s = await linha<{ saldo_centavos: number }>(db, "select saldo_centavos from saldos_orcamentos where orcamento_id = $1", [orc.id]);
    expect.soft(s?.saldo_centavos).toBe(88883);
    await ir(g, "/inicio");
    await expect.soft(g.getByText("R$ 888,83").first(), "Início mostra o saldo a receber").toBeVisible();
  });

  await test.step("recibo avulso", async () => {
    await ir(g, "/recibos/novo");
    await g.getByRole("radio", { name: "Avulso" }).click();
    await g.getByLabel("Referente a").fill("conserto de varão");
    await g.getByLabel("Recebi de").fill("Fulano Avulso");
    await valor(g).fill("150");
    await expect.soft(g.getByText("Recebi de Fulano Avulso a importância de cento e cinquenta reais, referente a conserto de varão.")).toBeVisible();
    await emitir(g).click();
    await g.waitForURL(/\/recibos\/[0-9a-f-]{36}/);
    await expect.soft(g.getByRole("heading", { name: "Recibo nº 0003" })).toBeVisible();
  });

  await test.step("lista, filtros e exportação", async () => {
    await ir(g, "/recibos?s=cancelado");
    await expect.soft(g.locator('a[href^="/recibos/"]').filter({ hasText: /^\d{4}$/ }), "filtro Cancelados").toHaveCount(1);
    await ir(g, "/recibos");
    await expect.soft(g.getByText(/3 recibo\(s\) · total emitido R\$ 1\.038,82/), "total emitido sem o cancelado").toBeVisible();
    const xlsx = await baixar(g, "/arquivos/recibos");
    expect.soft(xlsx.status).toBe(200);
    expect.soft(xlsx.tipo, "exporta .xlsx do mês").toContain("spreadsheetml");
  });

  await test.step("ficha do cliente: pago e em aberto", async () => {
    await ir(g, `/clientes/${cli}`);
    await expect.soft(g.getByText("R$ 888,82").first()).toBeVisible();
    await expect.soft(g.getByText("R$ 888,83").first()).toBeVisible();
  });

  await test.step("contador lê e exporta, não emite nem cancela; funcionária não entra", async () => {
    const c = await entrar("contador");
    await ir(c, "/recibos");
    await expect.soft(c.getByRole("link", { name: "Emitir recibo" })).toHaveCount(0);
    await expect.soft(c.getByRole("button", { name: "Cancelar" })).toHaveCount(0);
    await expect.soft(c.getByText(/3 recibo\(s\)/)).toBeVisible();
    expect.soft((await baixar(c, `/arquivos/recibo/${idSinal}`)).status, "contador baixa o PDF").toBe(200);
    expect.soft((await baixar(c, "/arquivos/recibos")).status, "contador exporta o .xlsx").toBe(200);
    await c.goto("/recibos/novo");
    await expect.soft(c, "contador não abre a emissão").toHaveURL(/\/sem-permissao/);
    const f = await entrar(await loginDaCatraca(db, "000000005"), { viewport: CELULAR });
    await f.goto("/recibos");
    await expect.soft(f, "funcionária não entra em recibos").not.toHaveURL(/\/recibos$/);
  });

  await test.step("numeração do talão só anda para frente", async () => {
    await ir(g, "/configuracoes");
    await g.getByLabel("Próximo recibo").fill("1");
    await g.getByRole("button", { name: "Salvar padrões" }).click();
    await expect(g.getByText(/precisa ser maior que 0003/)).toBeVisible();
    await g.getByLabel("Próximo recibo").fill("50");
    await g.getByRole("button", { name: "Salvar padrões" }).click();
    await expect(g.getByText("Numeração e padrões salvos")).toBeVisible();
    expect.soft((await linha<{ proximo: number }>(db, "select proximo from numeracao where tipo = 'recibo'"))?.proximo).toBe(50);
  });

  await test.step("celular", async () => {
    const gc = await entrar("cristina", { viewport: CELULAR });
    for (const rota of ["/recibos", "/recibos/novo", `/recibos/${idSinal}`]) {
      await ir(gc, rota);
      expect.soft(await semRolagemLateral(gc), `celular sem rolagem lateral em ${rota}`).toBe(true);
    }
  });
});
