/**
 * Fechamento e reabertura da semana (funções do banco) e acesso aos espelhos no Storage.
 * Tudo em transação com ROLLBACK (ver tests/rls/banco.ts).
 */
import { describe, expect, it } from "vitest";

import { cenario, como, contar, db, falha, SEGUNDA, TERCA, usarBanco } from "./banco";

usarBanco();

const resultado = (fid: string) =>
  JSON.stringify([
    {
      funcionaria_id: fid,
      saldo_anterior_min: 10,
      extras_semana_min: 0,
      ajustes_min: 0,
      acumulado_min: 10,
      fechou_corte: false,
      proxima_semana_min: 10,
      trabalhadas_min: 0,
      dias_trabalhados: 0,
      espelho_path: `${fid}/${SEGUNDA}.pdf`,
    },
  ]);
const dias = (fid: string, data = TERCA) =>
  JSON.stringify([{ funcionaria_id: fid, data, entrada: "07:00", saida_almoco: null, volta_almoco: null, saida: null, trabalhadas_min: null, extra_min: 0, situacao: "falta", ajustado: false }]);

const fechar = (segunda: string, fid: string, data?: string) =>
  db.query("select public.fechar_semana($1, $2::jsonb, $3::jsonb, '{}'::jsonb)", [segunda, resultado(fid), dias(fid, data)]);

describe("fechar a semana", () => {
  it("só a gestora fecha", () =>
    cenario(async (c) => {
      await db.query("insert into semanas (segunda) values ($1)", [SEGUNDA]);
      for (const quem of [c.f1.uid, c.contador]) {
        await como(quem, async () => {
          expect(await falha("select public.fechar_semana($1, $2::jsonb, $3::jsonb, '{}'::jsonb)", [SEGUNDA, resultado(c.f1.id), dias(c.f1.id)])).toMatch(/Apenas a gestora/);
        });
      }
    }));

  it("fecha tudo de uma vez: fotografia, status, evento — e trava a semana", () =>
    cenario(async (c) => {
      await db.query("insert into semanas (segunda) values ($1)", [SEGUNDA]);
      await como(c.gestora, async () => {
        await fechar(SEGUNDA, c.f1.id);
        expect(await contar("semana_resultados", "segunda = $1", [SEGUNDA])).toBe(1);
        expect(await contar("semana_resultado_dias", "segunda = $1", [SEGUNDA])).toBe(1);
        expect(await contar("semanas", "segunda = $1 and status = 'fechada' and fechada_por = $2", [SEGUNDA, c.gestora])).toBe(1);
        expect(await contar("semana_eventos", "segunda = $1 and acao = 'fechar'", [SEGUNDA])).toBe(1);
        expect(await falha("insert into ponto_lancamentos (funcionaria_id, data, tipo, ocorrencia, motivo) values ($1, $2, 'ocorrencia', 'folga', 'x')", [c.f1.id, TERCA])).toMatch(/está fechada/);
        expect(await falha("select public.fechar_semana($1, $2::jsonb, $3::jsonb, '{}'::jsonb)", [SEGUNDA, resultado(c.f1.id), dias(c.f1.id)])).toMatch(/já está fechada/);
      });
    }));

  it("respeita a ordem: semana anterior aberta com batida impede", () =>
    cenario(async (c) => {
      const seguinte = "2031-03-10";
      await db.query("insert into semanas (segunda) values ($1), ($2)", [SEGUNDA, seguinte]);
      await db.query("insert into batidas (en_no, funcionaria_id, data, hora_seg) values ('900000001', $1, '2031-03-11', 25200)", [c.f1.id]);
      await como(c.gestora, async () => {
        expect(await falha("select public.fechar_semana($1, $2::jsonb, $3::jsonb, '{}'::jsonb)", [seguinte, resultado(c.f1.id), dias(c.f1.id, "2031-03-11")])).toMatch(/Feche antes a semana de 03\/03\/2031/);
      });
    }));

  it("não fecha uma semana anterior a outra já fechada", () =>
    cenario(async (c) => {
      await db.query("insert into semanas (segunda, status) values ($1, 'aberta'), ('2031-03-17', 'fechada')", [SEGUNDA]);
      await como(c.gestora, async () => {
        expect(await falha("select public.fechar_semana($1, $2::jsonb, $3::jsonb, '{}'::jsonb)", [SEGUNDA, resultado(c.f1.id), dias(c.f1.id)])).toMatch(/reabra-a antes/);
      });
    }));

  it("recusa dia fora da semana", () =>
    cenario(async (c) => {
      await db.query("insert into semanas (segunda) values ($1)", [SEGUNDA]);
      await como(c.gestora, async () => {
        expect(await falha("select public.fechar_semana($1, $2::jsonb, $3::jsonb, '{}'::jsonb)", [SEGUNDA, resultado(c.f1.id), dias(c.f1.id, "2031-03-20")])).toMatch(/fora da semana/);
      });
    }));
});

describe("reabrir a semana", () => {
  it("só a última fechada, com motivo; desfaz a fotografia e registra quem reabriu", () =>
    cenario(async (c) => {
      await db.query("insert into semanas (segunda) values ($1)", [SEGUNDA]);
      await como(c.gestora, async () => {
        await fechar(SEGUNDA, c.f1.id);
        // A semana de 24/02 (do cenário) é anterior a uma fechada depois dela.
        expect(await falha("select public.reabrir_semana('2031-02-24', 'Correção')")).toMatch(/Reabra antes a semana de 03\/03\/2031/);
        expect(await falha("select public.reabrir_semana($1, ' ')", [SEGUNDA])).toMatch(/motivo/);
        await db.query("select public.reabrir_semana($1, 'Batida esquecida')", [SEGUNDA]);
        expect(await contar("semanas", "segunda = $1 and status = 'aberta'", [SEGUNDA])).toBe(1);
        expect(await contar("semana_resultados", "segunda = $1", [SEGUNDA])).toBe(0);
        expect(await contar("semana_resultado_dias", "segunda = $1", [SEGUNDA])).toBe(0);
        expect(await contar("semana_eventos", "segunda = $1 and acao = 'reabrir' and motivo = 'Batida esquecida' and autor = $2", [SEGUNDA, c.gestora])).toBe(1);
      });
    }));

  it("funcionária e contador não reabrem", () =>
    cenario(async (c) => {
      for (const quem of [c.f1.uid, c.contador]) {
        await como(quem, async () => {
          expect(await falha("select public.reabrir_semana('2031-02-24', 'quero')")).toMatch(/Apenas a gestora/);
        });
      }
    }));
});

describe("espelhos no Storage", () => {
  const objetos = async (f1: string, f2: string) => {
    await db.query("insert into storage.objects (bucket_id, name) values ('espelhos', $1), ('espelhos', $2)", [`${f1}/2031-02-24.pdf`, `${f2}/2031-02-24.pdf`]);
    return `bucket_id = 'espelhos' and name in ('${f1}/2031-02-24.pdf', '${f2}/2031-02-24.pdf')`;
  };
  const contarObjetos = async (filtro: string) => Number((await db.query(`select count(*) from storage.objects where ${filtro}`)).rows[0].count);

  it("funcionária lê só a própria pasta; contador e gestora leem todas", () =>
    cenario(async (c) => {
      const filtro = await objetos(c.f1.id, c.f2.id);
      await como(c.f1.uid, async () => expect(await contarObjetos(filtro)).toBe(1));
      await como(c.f2.uid, async () => expect(await contarObjetos(filtro)).toBe(1));
      await como(c.contador, async () => expect(await contarObjetos(filtro)).toBe(2));
      await como(c.gestora, async () => expect(await contarObjetos(filtro)).toBe(2));
      await como(c.semPerfil, async () => expect(await contarObjetos(filtro)).toBe(0));
      await como(c.desativada, async () => expect(await contarObjetos(filtro)).toBe(0));
    }));

  it("só a gestora grava espelho", () =>
    cenario(async (c) => {
      for (const quem of [c.f1.uid, c.contador]) {
        await como(quem, async () => {
          expect(await falha("insert into storage.objects (bucket_id, name) values ('espelhos', $1)", [`${c.f1.id}/2031-03-03.pdf`])).toMatch(/row-level security/);
        });
      }
      await como(c.gestora, async () => {
        await db.query("insert into storage.objects (bucket_id, name) values ('espelhos', $1)", [`${c.f1.id}/2031-03-03.pdf`]);
      });
    }));
});
