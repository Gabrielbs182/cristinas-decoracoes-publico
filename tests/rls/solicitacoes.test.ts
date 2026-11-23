/**
 * Pedidos de correção (regras de criação e aprovação no banco) e os anexos no Storage.
 * Tudo em transação com ROLLBACK (ver tests/rls/banco.ts).
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { cenario, como, contar, db, falha, SEGUNDA_PASSADA, TERCA, TERCA_PASSADA, usarBanco } from "./banco";

usarBanco();

const pedir = (fid: string, data: string, extra: { anexo?: string } = {}) =>
  db.query("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo, anexo_path) values ($1, $2, 'V', 47700, 'Esqueci', $3) returning id", [
    fid,
    data,
    extra.anexo ?? null,
  ]);

const aprovar = (id: number, lancamento: object, resposta = "") =>
  db.query("select public.aprovar_solicitacao($1, $2::jsonb, $3) as id", [id, JSON.stringify(lancamento), resposta]);

/** O pedido que o cenário já traz: F2, saída às 17:00 (61200 s) na terça passada. */
const pedidoDaF2 = async (fid: string) =>
  Number((await db.query("select id from solicitacoes_correcao where funcionaria_id = $1", [fid])).rows[0].id);

describe("criar pedido", () => {
  it("a funcionária pede para si, de dia que já passou e de semana aberta", () =>
    cenario(async (c) => {
      await db.query("insert into semanas (segunda, status) values ('2021-02-22', 'fechada')");
      // O anexo precisa existir no Storage (o app envia antes de gravar o pedido).
      const anexo = `${c.f1.id}/${TERCA_PASSADA}-${randomUUID()}.jpg`;
      await db.query("insert into storage.objects (bucket_id, name) values ('anexos', $1)", [anexo]);
      await como(c.f1.uid, async () => {
        await pedir(c.f1.id, TERCA_PASSADA, { anexo });
        expect(await falha("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo) values ($1, $2, 'V', 47700, 'x')", [c.f1.id, TERCA])).toMatch(
          /ainda não chegou/,
        );
        expect(await falha("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo) values ($1, '2021-02-23', 'V', 47700, 'x')", [c.f1.id])).toMatch(
          /já foi fechada/,
        );
        expect(
          await falha("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo, anexo_path) values ($1, $2, 'V', 47700, 'x', $3)", [
            c.f1.id,
            TERCA_PASSADA,
            `${c.f2.id}/foto.jpg`,
          ]),
        ).toMatch(/fora da pasta/);
      });
      expect(await contar("solicitacoes_correcao", "funcionaria_id = $1", [c.f1.id])).toBe(1);
    }));
});

describe("aprovar pedido", () => {
  it("só a gestora aprova", () =>
    cenario(async (c) => {
      const id = await pedidoDaF2(c.f2.id);
      for (const quem of [c.f2.uid, c.contador]) {
        await como(quem, async () => {
          expect(await falha("select public.aprovar_solicitacao($1, $2::jsonb, '')", [id, JSON.stringify({ tipo: "adicionar_batida", hora_seg: 61200, tipo_batida: "S" })])).toMatch(
            /Apenas a gestora/,
          );
        });
      }
    }));

  it("o lançamento precisa ser exatamente o que ela pediu", () =>
    cenario(async (c) => {
      const id = await pedidoDaF2(c.f2.id);
      await como(c.gestora, async () => {
        for (const errado of [
          { tipo: "adicionar_batida", hora_seg: 61260, tipo_batida: "S" }, // outro horário
          { tipo: "adicionar_batida", hora_seg: 61200, tipo_batida: "V" }, // outra batida
          { tipo: "ocorrencia", ocorrencia: "atestado" }, // pediu batida, não ocorrência
          { tipo: "desconsiderar_batida", batida_id: 1 },
        ]) {
          expect(await falha("select public.aprovar_solicitacao($1, $2::jsonb, '')", [id, JSON.stringify(errado)])).toMatch(/não corresponde/);
        }
      });
      expect(await contar("solicitacoes_correcao", "id = $1 and status = 'pendente'", [id])).toBe(1);
    }));

  it("aprova tudo de uma vez: lançamento com o motivo dela e resposta registrada", () =>
    cenario(async (c) => {
      const id = await pedidoDaF2(c.f2.id);
      await como(c.gestora, async () => {
        const { rows } = await aprovar(id, { tipo: "adicionar_batida", hora_seg: 61200, tipo_batida: "S" });
        expect(await contar("ponto_lancamentos", "id = $1 and solicitacao_id = $2 and autor = $3 and motivo = 'Pedido da funcionária: x'", [rows[0].id, id, c.gestora])).toBe(1);
        expect(await contar("solicitacoes_correcao", "id = $1 and status = 'aprovada' and resposta = 'Aprovado.' and respondida_por = $2", [id, c.gestora])).toBe(1);
        expect(await falha("select public.aprovar_solicitacao($1, $2::jsonb, '')", [id, JSON.stringify({ tipo: "adicionar_batida", hora_seg: 61200, tipo_batida: "S" })])).toMatch(
          /já foi respondida/,
        );
      });
    }));

  it("se o lançamento não entra (semana fechada no meio), o pedido continua pendente", () =>
    cenario(async (c) => {
      const id = await pedidoDaF2(c.f2.id);
      await db.query("insert into semanas (segunda, status) values ($1, 'fechada')", [SEGUNDA_PASSADA]);
      await como(c.gestora, async () => {
        expect(await falha("select public.aprovar_solicitacao($1, $2::jsonb, '')", [id, JSON.stringify({ tipo: "adicionar_batida", hora_seg: 61200, tipo_batida: "S" })])).toMatch(
          /está fechada/,
        );
      });
      expect(await contar("solicitacoes_correcao", "id = $1 and status = 'pendente'", [id])).toBe(1);
      expect(await contar("ponto_lancamentos", "solicitacao_id = $1", [id])).toBe(0);
    }));

  it("ocorrência pedida só aprova com a mesma ocorrência", () =>
    cenario(async (c) => {
      const id = await como(c.f1.uid, async () =>
        Number(
          (await db.query("insert into solicitacoes_correcao (funcionaria_id, data, ocorrencia, motivo) values ($1, $2, 'atestado', 'Consulta') returning id", [c.f1.id, SEGUNDA_PASSADA]))
            .rows[0].id,
        ),
      );
      await como(c.gestora, async () => {
        expect(await falha("select public.aprovar_solicitacao($1, $2::jsonb, '')", [id, JSON.stringify({ tipo: "ocorrencia", ocorrencia: "falta_justificada" })])).toMatch(/não corresponde/);
        await aprovar(id, { tipo: "ocorrencia", ocorrencia: "atestado" }, "Recebi o atestado.");
      });
      expect(await contar("solicitacoes_correcao", "id = $1 and resposta = 'Recebi o atestado.'", [id])).toBe(1);
      expect(await contar("ponto_lancamentos", "solicitacao_id = $1 and tipo = 'ocorrencia' and ocorrencia = 'atestado'", [id])).toBe(1);
    }));
});

describe("anexos no Storage", () => {
  const objetos = async (f1: string, f2: string) => {
    await db.query("insert into storage.objects (bucket_id, name) values ('anexos', $1), ('anexos', $2)", [`${f1}/a.jpg`, `${f2}/b.jpg`]);
    return `bucket_id = 'anexos' and name in ('${f1}/a.jpg', '${f2}/b.jpg')`;
  };
  const contarObjetos = async (filtro: string) => Number((await db.query(`select count(*) from storage.objects where ${filtro}`)).rows[0].count);

  it("dado de saúde: a funcionária lê só a pasta dela, a gestora lê tudo, o contador nada", () =>
    cenario(async (c) => {
      const filtro = await objetos(c.f1.id, c.f2.id);
      await como(c.f1.uid, async () => expect(await contarObjetos(filtro)).toBe(1));
      await como(c.f2.uid, async () => expect(await contarObjetos(filtro)).toBe(1));
      await como(c.gestora, async () => expect(await contarObjetos(filtro)).toBe(2));
      await como(c.contador, async () => expect(await contarObjetos(filtro)).toBe(0));
      await como(c.semPerfil, async () => expect(await contarObjetos(filtro)).toBe(0));
      await como(c.desativada, async () => expect(await contarObjetos(filtro)).toBe(0));
    }));

  it("a funcionária envia só para a pasta dela; gestora e contador não enviam", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        await db.query("insert into storage.objects (bucket_id, name) values ('anexos', $1)", [`${c.f1.id}/novo.jpg`]);
        expect(await falha("insert into storage.objects (bucket_id, name) values ('anexos', $1)", [`${c.f2.id}/intruso.jpg`])).toMatch(/row-level security/);
      });
      for (const quem of [c.gestora, c.contador]) {
        await como(quem, async () => {
          expect(await falha("insert into storage.objects (bucket_id, name) values ('anexos', $1)", [`${c.f1.id}/outro.jpg`])).toMatch(/row-level security/);
        });
      }
    }));

  it("ninguém apaga anexo pela API", () =>
    cenario(async (c) => {
      const filtro = await objetos(c.f1.id, c.f2.id);
      for (const quem of [c.f1.uid, c.gestora]) {
        await como(quem, async () => {
          // Sem policy de exclusão: o delete não acha a linha (ou o Storage recusa com erro; os dois servem).
          await db.query("savepoint apagar");
          const apagadas = await db.query(`delete from storage.objects where ${filtro}`).then(
            (r) => r.rowCount ?? 0,
            () => 0,
          );
          await db.query("rollback to savepoint apagar");
          expect(apagadas).toBe(0);
        });
      }
      expect(await contarObjetos(filtro)).toBe(2);
    }));
});
