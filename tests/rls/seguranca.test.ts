/**
 * Regressões da auditoria de segurança de 24/10/2026 no banco: a funcionária tem o próprio JWT e pode falar
 * direto com a API (PostgREST), sem passar pelo formulário. O banco precisa repetir o que o app garante.
 * Tudo em transação com ROLLBACK (ver tests/rls/banco.ts).
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { cenario, como, contar, db, falha, TERCA_PASSADA, usarBanco } from "./banco";

usarBanco();

const PEDIDO = "insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo, anexo_path) values ($1, $2, $3, 47700, $4, $5)";
const pedir = (fid: string, { batida = "V", motivo = "Esqueci", anexo = null as string | null } = {}): [string, unknown[]] => [
  PEDIDO,
  [fid, TERCA_PASSADA, batida, motivo, anexo],
];
const guardarNoStorage = (nome: string) => db.query("insert into storage.objects (bucket_id, name) values ('anexos', $1)", [nome]);

describe("pedido de correção pela API direta", () => {
  // Antes só a pasta (1º segmento) era conferida: "<id dela>/../../<rota>" virava link no painel da gestora.
  it("anexo só no formato que o app grava e que exista no Storage", () =>
    cenario(async (c) => {
      const certo = `${c.f1.id}/${TERCA_PASSADA}-${randomUUID()}.jpg`;
      const naoEnviado = `${c.f1.id}/${TERCA_PASSADA}-${randomUUID()}.jpg`;
      await guardarNoStorage(certo);
      await como(c.f1.uid, async () => {
        for (const anexo of [
          `${c.f1.id}/../../ponto/solicitacoes`,
          `${c.f1.id}/${TERCA_PASSADA}-x.jpg`,
          `${c.f1.id}/2021-01-01-${randomUUID()}.jpg`, // data de outro dia
          `${c.f1.id}/${TERCA_PASSADA}-${randomUUID()}.html`,
          naoEnviado,
        ]) {
          expect(await falha(...pedir(c.f1.id, { anexo })), anexo).toMatch(/fora da pasta/);
        }
        await db.query(...pedir(c.f1.id, { anexo: certo }));
      });
      expect(await contar("solicitacoes_correcao", "funcionaria_id = $1", [c.f1.id])).toBe(1);
    }));

  it("data de criação é a do banco, não a do pedido; resposta não vem no pedido", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        await db.query(
          "insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo, criada_em) values ($1, $2, 'V', 47700, 'x', '2020-01-01')",
          [c.f1.id, TERCA_PASSADA],
        );
        expect(
          await falha("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo, respondida_em) values ($1, $2, 'S', 61200, 'x', now())", [
            c.f1.id,
            TERCA_PASSADA,
          ]),
        ).toMatch(/pendente e sem resposta/);
      });
      expect(await contar("solicitacoes_correcao", "funcionaria_id = $1 and criada_em > now() - interval '1 minute'", [c.f1.id])).toBe(1);
    }));

  it("motivo tem o limite do formulário (500)", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        expect(await falha(...pedir(c.f1.id, { motivo: "x".repeat(501) }))).toMatch(/solicitacao_motivo_tamanho/);
        await db.query(...pedir(c.f1.id, { motivo: "x".repeat(500) }));
      });
    }));

  it("um pedido pendente por batida no dia; depois de respondido, pode pedir de novo", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        await db.query(...pedir(c.f1.id));
        expect(await falha(...pedir(c.f1.id))).toMatch(/solicitacao_pendente_batida/);
        await db.query(...pedir(c.f1.id, { batida: "S" })); // outra batida do mesmo dia pode
        const ocorrencia = "insert into solicitacoes_correcao (funcionaria_id, data, ocorrencia, motivo) values ($1, $2, $3, 'x')";
        await db.query(ocorrencia, [c.f1.id, TERCA_PASSADA, "atestado"]);
        expect(await falha(ocorrencia, [c.f1.id, TERCA_PASSADA, "falta_justificada"])).toMatch(/solicitacao_pendente_ocorrencia/);
      });
      await como(c.gestora, () =>
        db.query("update solicitacoes_correcao set status = 'recusada', resposta = 'Não' where funcionaria_id = $1 and tipo_batida = 'V'", [c.f1.id]),
      );
      await como(c.f1.uid, () => db.query(...pedir(c.f1.id)));
      expect(await contar("solicitacoes_correcao", "funcionaria_id = $1 and tipo_batida = 'V'", [c.f1.id])).toBe(2);
    }));
});

// Regressão (auditoria de 24/10/2026, I2): a gestora tinha UPDATE/DELETE direto nas tabelas do fechamento e, pela
// API, fechava/reabria sem motivo, sem evento e fora de ordem. Agora só fechar_semana/reabrir_semana gravam.
describe("fechamento só pelas funções do banco", () => {
  it("a gestora não fecha, reabre nem mexe na fotografia direto pela API", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        for (const sql of [
          "update semanas set status = 'aberta' where segunda = '2031-02-24'",
          "update semanas set regras = '{}' where segunda = '2031-02-24'",
          "update semana_resultados set acumulado_min = 0 where segunda = '2031-02-24'",
          "delete from semana_resultados where segunda = '2031-02-24'",
          `insert into semana_resultados (segunda, funcionaria_id, saldo_anterior_min, extras_semana_min, acumulado_min, fechou_corte, proxima_semana_min, trabalhadas_min, dias_trabalhados)
           values ('2031-02-24', '${c.f1.id}', 0, 0, 0, false, 0, 0, 0)`,
          "insert into semana_eventos (segunda, acao, motivo) values ('2031-02-24', 'reabrir', 'pela API')",
          "insert into semanas (segunda, status) values ('2031-03-10', 'fechada')",
        ]) {
          expect(await falha(sql), sql).toMatch(/só pelo fechamento/);
        }
      });
      expect(await contar("semana_resultados", "segunda = '2031-02-24'")).toBe(2);
    }));

  it("continua valendo: importar cria semana aberta e o espelho gerado grava o caminho", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        await db.query("insert into semanas (segunda) values ('2031-03-10') on conflict do nothing");
        await db.query("update semana_resultados set espelho_path = funcionaria_id || '/2031-02-24.pdf' where segunda = '2031-02-24'");
      });
      expect(await contar("semanas", "segunda = '2031-03-10' and status = 'aberta'")).toBe(1);
      expect(await contar("semana_resultados", "segunda = '2031-02-24' and espelho_path is not null")).toBe(2);
    }));
});
