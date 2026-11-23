/**
 * 0.5 — importar uma semana → a funcionária pede correção com foto pelo celular → a gestora aprova/recusa →
 * resolve pendências em lote → a funcionária vê a resposta, o banco e os espelhos. Anexo é dado de saúde:
 * a colega e o contador não abrem.
 */
import { statSync, writeFileSync } from "node:fs";

import { ID, SEGUNDA_SINTETICA as SEG, glogSintetico } from "../apoio/glog";
import { CELULAR, baixar, expect, ir, loginDaCatraca, semRolagemLateral, test } from "../apoio/teste";

test("portal da funcionária e pedidos de correção", async ({ entrar, novaPagina, db }, info) => {
  test.setTimeout(5 * 60_000);
  const foto = info.outputPath("atestado.jpg");

  await test.step("foto de celular pesada (3000×4000) para testar a redução no navegador", async () => {
    const p = await novaPagina();
    const b64 = await p.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 3000;
      c.height = 4000;
      const g = c.getContext("2d")!;
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = `hsl(${i % 360},70%,${30 + (i % 40)}%)`;
        g.fillRect(Math.random() * 3000, Math.random() * 4000, 120, 120);
      }
      g.fillStyle = "#000";
      g.font = "bold 160px sans-serif";
      g.fillText("ATESTADO", 600, 2000);
      return c.toDataURL("image/jpeg", 0.98).split(",")[1]!;
    });
    writeFileSync(foto, Buffer.from(b64, "base64"));
  });

  const g = await entrar("cristina");
  await test.step("gestora importa a semana sintética", async () => {
    await ir(g, "/ponto/importar");
    await g.setInputFiles('input[type="file"]', glogSintetico());
    await expect(g.getByText("Prévia ·")).toBeVisible();
    if (await g.getByRole("button", { name: /Nada novo para importar/ }).count()) {
      info.annotations.push({ type: "aviso", description: "a semana sintética já estava importada (rodada com E2E_SEM_ZERAR?)" });
    } else {
      await g.getByRole("button", { name: /Confirmar importação/ }).click();
      await expect(g.getByText("Importação concluída")).toBeVisible();
    }
  });

  const t = await entrar(await loginDaCatraca(db, ID.FALTOU_VOLTA), { viewport: CELULAR });
  await test.step("funcionária vê a pendência no celular e pede a correção com foto", async () => {
    await ir(t, `/meu-ponto?s=${SEG}`);
    await expect.soft(t.getByText("Você tem 1 pendência. Toque para resolver.")).toBeVisible();
    await expect.soft(t.locator('nav[aria-label="Portal"] [aria-label="1 pendência(s)"]'), "selo 1 na aba Pendências").toHaveCount(1);
    expect.soft(await semRolagemLateral(t), "Ponto: sem rolagem lateral").toBe(true);
    await t.getByText("Você tem 1 pendência").click();
    await t.waitForURL(/\/meu-ponto\/pendencias/);
    await expect.soft(t.getByText("Você esqueceu de bater a volta do almoço em 29/09.")).toBeVisible();
    await t.getByRole("link", { name: "Informar horário" }).click();
    await t.waitForURL(/\/meu-ponto\/corrigir\?dia=2026-09-29&tipo=V/);
    await expect.soft(t.locator("select"), "dia já escolhido").toHaveValue("2026-09-29");
    await expect.soft(t.getByRole("button", { name: "Volta do almoço" }), "batida já escolhida").toHaveAttribute("aria-pressed", "true");
    await expect.soft(t.getByRole("button", { name: "Enviar para a gestora" }), "sem horário e motivo não envia").toBeDisabled();
    await t.getByPlaceholder("HH:MM").fill("1315");
    await expect.soft(t.getByPlaceholder("HH:MM"), "máscara do horário").toHaveValue("13:15");
    await t.locator("textarea").fill("Esqueci de bater na volta do almoço");
    await t.setInputFiles('input[type="file"]', foto);
    await expect(t.getByText("atestado.jpg")).toBeVisible();
    expect.soft(await semRolagemLateral(t), "Corrigir: sem rolagem lateral").toBe(true);
    await t.getByRole("button", { name: "Enviar para a gestora" }).click();
    await t.waitForURL(/\/meu-ponto\/solicitacoes/);
    await expect(t.getByText("Pedido enviado para a gestora")).toBeVisible();
    await expect.soft(t.getByText("Aguardando").first()).toBeVisible();
    await ir(t, "/meu-ponto/pendencias");
    await expect.soft(t.getByText("Correção enviada · aguardando")).toBeVisible();
    await expect.soft(t.locator('nav[aria-label="Portal"] [aria-label$="pendência(s)"]'), "selo some depois do pedido").toHaveCount(0);
  });

  await test.step("pedido repetido é recusado", async () => {
    await ir(t, "/meu-ponto/corrigir?dia=2026-09-29&tipo=V");
    await t.getByPlaceholder("HH:MM").fill("1320");
    await t.locator("textarea").fill("De novo");
    await t.getByRole("button", { name: "Enviar para a gestora" }).click();
    await expect(t.getByText("Você já pediu essa correção")).toBeVisible();
  });

  const { rows: anexos } = await db.query(
    `select s.anexo_path, (o.metadata->>'size')::int tamanho, o.metadata->>'mimetype' tipo
       from solicitacoes_correcao s join storage.objects o on o.bucket_id = 'anexos' and o.name = s.anexo_path
      where s.data = '2026-09-29'`,
  );
  expect(anexos, "anexo gravado na pasta dela no Storage").toHaveLength(1);
  const anexo = anexos[0].anexo_path as string;
  const original = statSync(foto).size;
  expect.soft(anexos[0].tipo).toBe("image/jpeg");
  expect.soft(anexos[0].tamanho, `foto reduzida antes do envio (original: ${original} bytes)`).toBeLessThan(original / 3);

  const m = await entrar(await loginDaCatraca(db, ID.DUAS_VOLTAS), { viewport: CELULAR });
  await test.step("colega pede para alterar a saída e não abre o anexo da outra", async () => {
    await ir(m, "/meu-ponto/corrigir?dia=2026-09-28");
    await m.getByRole("button", { name: "Saída", exact: true }).click();
    await m.getByPlaceholder("HH:MM").fill("1830");
    await m.locator("textarea").fill("Fiquei até mais tarde arrumando o mostruário");
    await m.getByRole("button", { name: "Enviar para a gestora" }).click();
    await m.waitForURL(/\/meu-ponto\/solicitacoes/);
    expect.soft((await baixar(m, `/arquivos/anexo/${anexo}`)).status, "colega não abre o anexo").toBe(404);
    expect.soft((await baixar(t, `/arquivos/anexo/${anexo}`)).status, "a dona abre o próprio anexo").toBe(200);
    await m.goto("/ponto/solicitacoes");
    await expect.soft(m, "funcionária não entra na fila da gestora").toHaveURL(/\/sem-permissao/);
  });

  await test.step("gestora aprova um pedido e recusa o outro com resposta", async () => {
    await ir(g, "/inicio");
    await expect.soft(g.getByText("Volta do almoço às 13:15"), "Início descreve o pedido").toBeVisible();
    await ir(g, "/ponto/solicitacoes");
    await expect(g.getByText("Aguardando resposta (2)")).toBeVisible();
    const cartaoT = g.locator("div.grid", { hasText: "Esqueci de bater na volta do almoço" }).first();
    await expect.soft(cartaoT.getByText("Ao aprovar: adiciona a volta do almoço às 13:15, com o motivo dela.")).toBeVisible();
    await expect.poll(() => cartaoT.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { message: "miniatura do anexo carrega" }).toBe(true);
    const cartaoM = g.locator("div.grid", { hasText: "Fiquei até mais tarde" }).first();
    await expect.soft(cartaoM.getByText(/Ao aprovar: altera a saída de \d\d:\d\d para 18:30/)).toBeVisible();
    await cartaoT.getByRole("button", { name: "Aprovar" }).click();
    await expect(g.getByText("Aprovado · adiciona a volta do almoço às 13:15")).toBeVisible();
    await cartaoM.getByRole("button", { name: "Recusar" }).click();
    await cartaoM.getByPlaceholder("Resposta para a funcionária (obrigatória)").fill("A câmera mostra a saída no horário da catraca.");
    await cartaoM.getByRole("button", { name: "Recusar e responder" }).click();
    await expect(g.getByText("Solicitação recusada · resposta enviada")).toBeVisible();
    await expect(g.getByText("Aguardando resposta (0)")).toBeVisible();
    await expect.soft(g.getByText("Nenhuma solicitação aguardando")).toHaveCount(1);
    const { rows: lanc } = await db.query(
      "select l.tipo, l.hora_seg, l.motivo from ponto_lancamentos l join solicitacoes_correcao s on s.id = l.solicitacao_id",
    );
    expect.soft(lanc, "a aprovação virou um lançamento no diário").toHaveLength(1);
    expect.soft(lanc[0]).toMatchObject({ tipo: "adicionar_batida", hora_seg: 13 * 3600 + 15 * 60 });
    expect.soft(lanc[0]?.motivo).toMatch(/^Pedido da funcionária:/);
  });

  await test.step("pendências em lote só do mesmo tipo", async () => {
    await ir(g, `/ponto/pendencias?s=${SEG}&f=bloqueia`);
    const caixas = g.getByRole("checkbox", { name: "Selecionar: Faltou a volta do almoço" });
    await expect.soft(caixas, "sobram as 2 voltas da colega (a outra foi resolvida pelo pedido)").toHaveCount(2);
    await caixas.first().check();
    await expect(g.getByText("1 selecionada · Faltou a volta do almoço")).toBeVisible();
    await expect.soft(g.getByRole("checkbox", { name: "Selecionar: Faltou a saída para o almoço" }), "lote não mistura tipos").toBeDisabled();
    await g.getByRole("button", { name: "Selecionar as 2 deste tipo" }).click();
    await expect(g.getByText("2 selecionadas · Faltou a volta do almoço")).toBeVisible();
    await g.getByRole("button", { name: "Aceitar sugestão em todas" }).click();
    await expect(g.getByText("2 pendência(s) resolvida(s)")).toBeVisible();
    await expect.soft(caixas, "lote resolveu as duas").toHaveCount(0);
  });

  await test.step("funcionárias veem a resposta, o banco e os espelhos", async () => {
    await ir(t, "/meu-ponto/solicitacoes");
    await expect.soft(t.getByText("Aprovada")).toBeVisible();
    await ir(t, `/meu-ponto?s=${SEG}`);
    await expect.soft(t.getByText(/pendência/), "sem pendência depois da aprovação").toHaveCount(0);
    await ir(m, "/meu-ponto/solicitacoes");
    await expect.soft(m.getByText("A câmera mostra a saída no horário da catraca."), "vê a recusa com a resposta").toBeVisible();
    await ir(t, "/meu-ponto/banco");
    await expect.soft(t.getByText("Como chegou aqui")).toBeVisible();
    expect.soft(await semRolagemLateral(t), "Banco: sem rolagem lateral").toBe(true);
    await ir(t, "/meu-ponto/espelhos");
    expect.soft(await semRolagemLateral(t), "Espelhos: sem rolagem lateral").toBe(true);
    const espelhos = t.locator('a[href^="/arquivos/espelho/"]');
    if (await espelhos.count()) {
      const href = (await espelhos.first().getAttribute("href"))!;
      expect.soft(await baixar(t, href), `espelho em PDF (${href})`).toEqual({ status: 200, tipo: "application/pdf" });
    } else {
      info.annotations.push({ type: "pulado", description: "banco de teste sem semana fechada: download do espelho não conferido" });
    }
  });

  await test.step("contador não abre anexo (dado de saúde)", async () => {
    const c = await entrar("contador");
    expect.soft((await baixar(c, `/arquivos/anexo/${anexo}`)).status).toBe(404);
  });
});
