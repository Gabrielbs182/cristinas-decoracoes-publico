/**
 * 0.4 — fechar a semana: resolver o que bloqueia → fechar (gera os espelhos em PDF e libera a planilha) → cada
 * papel baixa só o que pode → reabrir com motivo. Usa a semana sintética de 28/09/2026 (importa se faltar).
 */
import ExcelJS from "exceljs";

import { ID, SEGUNDA_SINTETICA as SEG, glogSintetico } from "../apoio/glog";
import { CELULAR, baixar, expect, ir, linha, loginDaCatraca, test } from "../apoio/teste";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

test("fechamento da semana", async ({ entrar, db }) => {
  test.setTimeout(5 * 60_000);
  const g = await entrar("cristina");
  const status = async () => (await linha<{ status: string }>(db, "select status::text from semanas where segunda = $1", [SEG]))?.status;

  await test.step("semana sintética importada e aberta", async () => {
    if (await status() === "fechada") test.skip(true, "a semana sintética já está fechada (rodada com E2E_SEM_ZERAR?)");
    if (!(await linha(db, "select 1 from batidas where data between $1::date and $1::date + 4 limit 1", [SEG]))) {
      await ir(g, "/ponto/importar");
      await g.setInputFiles('input[type="file"]', glogSintetico());
      await g.getByRole("button", { name: /Confirmar importação/ }).click();
      await expect(g.getByText("Importação concluída")).toBeVisible();
    }
  });

  await test.step("fechar fica travado enquanto há pendência que bloqueia", async () => {
    await ir(g, `/ponto/fechamento?s=${SEG}`);
    const pendentes = await g.getByText(/ainda aberta\(s\)/).count();
    if (pendentes) await expect.soft(g.getByRole("button", { name: "Fechar semana" }), "com pendência que bloqueia não fecha").toBeDisabled();
  });

  await test.step("resolve as pendências que bloqueiam, tipo a tipo", async () => {
    await ir(g, `/ponto/pendencias?s=${SEG}&f=bloqueia`);
    for (let rodada = 0; rodada < 10; rodada++) {
      const caixa = g.locator('[aria-label^="Selecionar: "]:not([disabled])').first();
      if (!(await caixa.count())) break;
      await caixa.check();
      const todas = g.getByRole("button", { name: /^Selecionar as \d+ deste tipo$/ });
      if (await todas.count()) await todas.click();
      await g.getByRole("button", { name: "Aceitar sugestão em todas" }).click();
      await expect(g.getByText(/pendência\(s\) resolvida\(s\)/).first()).toBeVisible();
      await ir(g, `/ponto/pendencias?s=${SEG}&f=bloqueia`);
    }
    await expect(g.locator('[aria-label^="Selecionar: "]'), "nenhuma pendência que bloqueia").toHaveCount(0);
  });

  // Decisão de 25/10/2026: documento oficial sai com o nome do CADASTRO, não com o nome que a funcionária escolhe.
  const { nome: nomeCadastro, nome_exibicao: exibicaoOriginal } = (await linha<{ nome: string; nome_exibicao: string }>(
    db,
    "select nome, nome_exibicao from funcionarias where en_no = $1",
    [ID.FALTOU_VOLTA],
  ))!;
  await db.query("update funcionarias set nome_exibicao = 'Apelido E2E' where en_no = $1", [ID.FALTOU_VOLTA]);

  let espelho = "";
  await test.step("fecha: espelhos gerados, valores gravados, semana travada", async () => {
    await ir(g, `/ponto/fechamento?s=${SEG}`);
    await g.getByRole("button", { name: "Fechar semana" }).click();
    await g.getByRole("dialog").getByRole("button", { name: "Fechar semana" }).click();
    await expect(g.getByText(/Semana fechada · \d+ espelho\(s\) gerado\(s\)/)).toBeVisible({ timeout: 60_000 });
    await expect(g.getByText("Semana fechada e travada")).toBeVisible();
    expect.soft(await status()).toBe("fechada");
    const r = await linha<{ total: string; com_espelho: string }>(
      db,
      "select count(*) total, count(espelho_path) com_espelho from semana_resultados where segunda = $1",
      [SEG],
    );
    expect.soft(Number(r?.total), "uma fotografia por funcionária da semana (5 IDs na semana sintética)").toBe(5);
    expect.soft(r?.com_espelho, "todas com espelho").toBe(r?.total);
    espelho = (await g.locator(`a[href^="/arquivos/espelho/${SEG}/"]`).first().getAttribute("href")) ?? "";
    expect.soft(await baixar(g, espelho), "gestora baixa o espelho").toEqual({ status: 200, tipo: "application/pdf" });
    expect.soft(await baixar(g, `/arquivos/planilha/${SEG}`), "gestora baixa a planilha").toEqual({ status: 200, tipo: XLSX });

    const base64 = await g.evaluate(async (u) => {
      const bytes = new Uint8Array(await (await fetch(u)).arrayBuffer());
      let s = "";
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    }, `/arquivos/planilha/${SEG}`);
    const planilha = new ExcelJS.Workbook();
    await planilha.xlsx.load(Buffer.from(base64, "base64") as unknown as ArrayBuffer);
    const textos: string[] = [];
    planilha.eachSheet((aba) => aba.eachRow((l) => l.eachCell((c) => void textos.push(c.text))));
    expect.soft(textos.some((t) => t.includes(nomeCadastro)), `planilha com o nome do cadastro (${nomeCadastro})`).toBe(true);
    expect.soft(textos.some((t) => t.includes("Apelido E2E")), "planilha sem o nome escolhido").toBe(false);
    await db.query("update funcionarias set nome_exibicao = $2 where en_no = $1", [ID.FALTOU_VOLTA, exibicaoOriginal]);
  });

  await test.step("contador lê a semana e baixa a planilha; funcionária só o próprio espelho", async () => {
    const c = await entrar("contador");
    await ir(c, `/rh/semanas/${SEG}`);
    await expect.soft(c.getByRole("heading").first()).toBeVisible();
    expect.soft((await baixar(c, `/arquivos/planilha/${SEG}`)).status, "contador baixa a planilha").toBe(200);
    expect.soft((await baixar(c, espelho)).status, "contador baixa o espelho").toBe(200);

    const dona = await linha<{ id: string }>(db, "select id from funcionarias where en_no = $1", [ID.FALTOU_VOLTA]);
    const colega = await linha<{ id: string }>(db, "select id from funcionarias where en_no = $1", [ID.DUAS_VOLTAS]);
    const f = await entrar(await loginDaCatraca(db, ID.FALTOU_VOLTA), { viewport: CELULAR });
    await ir(f, "/meu-ponto/espelhos");
    await expect.soft(f.locator(`a[href="/arquivos/espelho/${SEG}/${dona!.id}"]`), "a semana fechada aparece nos espelhos dela").toHaveCount(1);
    expect.soft((await baixar(f, `/arquivos/espelho/${SEG}/${dona!.id}`)).status, "o próprio espelho").toBe(200);
    expect.soft((await baixar(f, `/arquivos/espelho/${SEG}/${colega!.id}`)).status, "o espelho da colega não").toBe(404);
    expect.soft((await baixar(f, `/arquivos/planilha/${SEG}`)).status, "a planilha da equipe não").toBe(403);
  });

  await test.step("reabrir exige motivo e fica registrado", async () => {
    await ir(g, `/ponto/fechamento?s=${SEG}`);
    await g.getByRole("button", { name: "Reabrir semana" }).click();
    await expect.soft(g.getByRole("dialog").getByRole("button", { name: "Reabrir", exact: true }), "sem motivo não reabre").toBeDisabled();
    await g.getByPlaceholder("Motivo da reabertura (obrigatório)").fill("Conferência do teste de regressão");
    await g.getByRole("dialog").getByRole("button", { name: "Reabrir", exact: true }).click();
    await expect(g.getByText("Semana de 28/09/2026 reaberta")).toBeVisible();
    expect.soft(await status()).toBe("aberta");
    const evento = await linha<{ motivo: string }>(db, "select motivo from semana_eventos where segunda = $1 and acao = 'reabrir' order by id desc limit 1", [SEG]);
    expect.soft(evento?.motivo).toBe("Conferência do teste de regressão");
  });
});
