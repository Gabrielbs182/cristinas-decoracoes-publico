/**
 * Matriz de acesso do RLS, testada no próprio Postgres do Supabase local (ver tests/rls/banco.ts).
 */
import { describe, expect, it } from "vitest";

import { afetadas, cenario, como, contar, db, falha, SEGUNDA, TERCA, TERCA_PASSADA, TESTE, usarBanco } from "./banco";

usarBanco();

describe("funcionária", () => {
  it("vê só o próprio cadastro, as próprias batidas, lançamentos, ajustes e resultados", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        expect(await contar("funcionarias")).toBe(1);
        expect(await contar("batidas")).toBe(1);
        expect(await contar("ponto_lancamentos")).toBe(1);
        expect(await contar("ajustes_saldo")).toBe(1);
        expect(await contar("semana_resultados")).toBe(1);
        expect(await contar("solicitacoes_correcao")).toBe(0); // a solicitação é da F2
        expect(await contar("funcionarias", "id = $1", [c.f2.id])).toBe(0);
      });
    }));

  it("não vê importações, perfis alheios nem batidas de ID desconhecido", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        expect(await contar("importacoes")).toBe(0);
        expect(await contar("perfis")).toBe(1);
        expect(await contar("batidas", "funcionaria_id is null")).toBe(0);
      });
    }));

  it("pede correção para si mesma, mas não em nome de outra nem já aprovada", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        await db.query("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo) values ($1, $2, 'V', 47940, 'Esqueci')", [c.f1.id, TERCA_PASSADA]);
        expect(await falha("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo) values ($1, $2, 'V', 47940, 'x')", [c.f2.id, TERCA_PASSADA])).toMatch(/row-level security/);
        expect(await falha("insert into solicitacoes_correcao (funcionaria_id, data, tipo_batida, hora_seg, motivo, status, resposta) values ($1, $2, 'V', 47940, 'x', 'aprovada', 'ok')", [c.f1.id, TERCA_PASSADA])).toMatch(/pendente/);
      });
    }));

  it("não lança no diário, não mexe em batida e não muda o próprio papel", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        expect(await falha("insert into ponto_lancamentos (funcionaria_id, data, tipo, ocorrencia, motivo) values ($1, $2, 'ocorrencia', 'folga', 'x')", [c.f1.id, TERCA])).toMatch(/row-level security/);
        expect(await afetadas("update batidas set funcionaria_id = $1 where id = $2", [c.f1.id, c.batidaF1])).toBe(0);
        expect(await afetadas("update perfis set papel = 'gestora' where id = $1", [c.f1.uid])).toBe(0);
        expect(await falha("insert into importacoes (arquivo_nome, arquivo_sha256, linhas_lidas, batidas_novas, batidas_repetidas) values ('x','x',0,0,0)")).toMatch(/row-level security/);
      });
    }));
});

describe("contador", () => {
  it("lê cadastro, resultados de fechamento e ajustes; não lê batidas, diário nem solicitações", () =>
    cenario(async (c) => {
      await como(c.contador, async () => {
        expect(await contar("funcionarias", "nome like '[teste]%'")).toBe(3);
        expect(await contar("semana_resultados", TESTE)).toBe(2);
        expect(await contar("ajustes_saldo", TESTE)).toBe(2);
        expect(await contar("batidas")).toBe(0);
        expect(await contar("ponto_lancamentos")).toBe(0);
        expect(await contar("solicitacoes_correcao")).toBe(0);
        expect(await contar("importacoes")).toBe(0);
      });
    }));

  it("não grava nada", () =>
    cenario(async (c) => {
      await como(c.contador, async () => {
        expect(await falha("insert into feriados (data, nome, tipo) values ('2031-03-05', 'x', 'municipal')")).toMatch(/row-level security/);
        expect(await falha("insert into ajustes_saldo (funcionaria_id, segunda, minutos, motivo) values ($1, $2, 10, 'x')", [c.f1.id, SEGUNDA])).toMatch(/row-level security/);
        expect(await afetadas("update funcionarias set nome = 'x' where id = $1", [c.f1.id])).toBe(0);
      });
    }));
});

describe("gestora", () => {
  it("vê tudo, inclusive batidas de ID desconhecido", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        expect(await contar("batidas", "data = $1", [TERCA])).toBe(3);
        expect(await contar("ponto_lancamentos", TESTE)).toBe(2);
        expect(await contar("solicitacoes_correcao", TESTE)).toBe(1);
      });
    }));

  it("lança no diário, mas o diário não aceita alteração nem exclusão", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        const { rows } = await db.query(
          "insert into ponto_lancamentos (funcionaria_id, data, tipo, batida_id, motivo) values ($1, $2, 'desconsiderar_batida', $3, 'Duplicada') returning id",
          [c.f1.id, TERCA, c.batidaF1],
        );
        expect(rows[0].id).toBeTruthy();
      });
      // Nem o superusuário altera o diário: a trava é trigger, não policy.
      expect(await falha("update ponto_lancamentos set motivo = 'x' where " + TESTE)).toMatch(/só aceita inclusão/);
      expect(await falha("delete from ponto_lancamentos where " + TESTE)).toMatch(/só aceita inclusão/);
    }));

  it("batida da catraca é imutável; só ganha vínculo quando é de ID desconhecido", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        expect(await falha("update batidas set hora_seg = 0 where id = $1", [c.batidaF1])).toMatch(/imutável/);
        // Duas camadas: a API nem tem privilégio de DELETE…
        expect(await falha("delete from batidas where id = $1", [c.batidaF1])).toMatch(/permission denied/);
        expect(await falha("select public.vincular_id_catraca('900000099', $1)", [c.f2.id])).toMatch(/já está vinculada/);
      });
      // …e o trigger barra até o superusuário.
      expect(await falha("delete from batidas where id = $1", [c.batidaF1])).toMatch(/não pode ser apagada/);
    }));

  it("vincula um ID desconhecido e adota as batidas órfãs dele", () =>
    cenario(async (c) => {
      const nova = (await db.query("insert into funcionarias (nome, nome_exibicao) values ('[teste] Nova', 'Nova') returning id")).rows[0].id;
      await como(c.gestora, async () => {
        const adotadas = (await db.query("select public.vincular_id_catraca('900000099', $1) as n", [nova])).rows[0].n;
        expect(adotadas).toBe(1);
      });
    }));

  it("não grava em semana fechada", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        expect(await falha("insert into ponto_lancamentos (funcionaria_id, data, tipo, ocorrencia, motivo) values ($1, '2031-02-25', 'ocorrencia', 'folga', 'x')", [c.f1.id])).toMatch(/está fechada/);
        expect(await falha("insert into ajustes_saldo (funcionaria_id, segunda, minutos, motivo) values ($1, '2031-02-24', 10, 'x')", [c.f1.id])).toMatch(/está fechada/);
      });
    }));

  it("lançamento precisa ser da mesma funcionária e do mesmo dia da batida", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        expect(await falha("insert into ponto_lancamentos (funcionaria_id, data, tipo, batida_id, motivo) values ($1, $2, 'desconsiderar_batida', $3, 'x')", [c.f2.id, TERCA, c.batidaF1])).toMatch(/não é desta funcionária/);
      });
    }));

  it("responde a solicitação uma vez só, e a resposta registra quem respondeu", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        expect(await falha("update solicitacoes_correcao set status = 'recusada' where " + TESTE)).toMatch(/resposta/);
        await db.query("update solicitacoes_correcao set status = 'aprovada', resposta = 'Ok' where " + TESTE);
        const { rows } = await db.query("select respondida_por from solicitacoes_correcao where " + TESTE);
        expect(rows[0].respondida_por).toBe(c.gestora);
        expect(await falha("update solicitacoes_correcao set resposta = 'mudei' where " + TESTE)).toMatch(/já foi respondida/);
      });
    }));
});

describe("sem acesso", () => {
  it("usuário autenticado sem perfil não vê nada", () =>
    cenario(async (c) => {
      await como(c.semPerfil, async () => {
        for (const t of ["funcionarias", "regras_ponto", "feriados", "semanas", "batidas", "empresa", "perfis"]) {
          expect(await contar(t), t).toBe(0);
        }
      });
    }));

  it("perfil desativado não vê nada, nem o próprio cadastro", () =>
    cenario(async (c) => {
      await como(c.desativada, async () => {
        expect(await contar("funcionarias")).toBe(0);
        expect(await contar("batidas")).toBe(0);
        expect(await contar("regras_ponto")).toBe(0);
      });
    }));

  it("anônimo não tem privilégio em tabela nenhuma", () =>
    cenario(async () => {
      await como(null, async () => {
        expect(await falha("select count(*) from public.funcionarias")).toMatch(/permission denied/);
        expect(await falha("select count(*) from public.batidas")).toMatch(/permission denied/);
      });
    }));
});
