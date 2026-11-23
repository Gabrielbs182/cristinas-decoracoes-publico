/**
 * Equipe, acessos e regras (0.6): nome escolhido pela funcionária, última gestora, feriado em semana
 * fechada e regras com vigência. Tudo em transação com ROLLBACK (ver tests/rls/banco.ts).
 */
import { describe, expect, it } from "vitest";

import { afetadas, cenario, como, contar, db, falha, SEGUNDA, TERCA, usarBanco } from "./banco";

usarBanco();

const REGRAS = {
  carga_seg_qui_min: 510,
  carga_sex_min: 480,
  entrada_prevista_min: 450,
  almoco_inicio_previsto_min: 720,
  almoco_padrao_min: 60,
  hora_corte_min: 480,
  tolerancia_corte_min: 10,
  tolerancia_atraso_min: 5,
  janela_duplicada_min: 5,
};
const definir = (r: object = REGRAS) => db.query("select public.definir_regras($1::jsonb) as desde", [JSON.stringify(r)]);
const nomeExibicao = async (fid: string) => (await db.query("select nome_exibicao from funcionarias where id = $1", [fid])).rows[0].nome_exibicao as string;

describe("nome escolhido pela funcionária", () => {
  it("ela troca o próprio nome: perfil e cadastro juntos, sem tocar na colega", () =>
    cenario(async (c) => {
      await como(c.f1.uid, () => db.query("select public.alterar_meu_nome('  Bia   Souza ')"));
      expect(await nomeExibicao(c.f1.id)).toBe("Bia Souza");
      expect(await contar("perfis", "id = $1 and nome = 'Bia Souza'", [c.f1.uid])).toBe(1);
      expect(await nomeExibicao(c.f2.id)).toBe("[teste] F2");
      await como(c.f1.uid, async () => {
        expect(await falha("select public.alterar_meu_nome('B')")).toMatch(/de 2 a 40/);
      });
    }));

  it("sem acesso ativo não troca nada", () =>
    cenario(async (c) => {
      await como(c.desativada, async () => {
        expect(await falha("select public.alterar_meu_nome('Outra')")).toMatch(/Sem acesso/);
      });
      await como(c.semPerfil, async () => {
        expect(await falha("select public.alterar_meu_nome('Outra')")).toMatch(/Sem acesso/);
      });
    }));

  it("gestora e contador também trocam o próprio nome", () =>
    cenario(async (c) => {
      await como(c.contador, () => db.query("select public.alterar_meu_nome('Escritório Contábil')"));
      expect(await contar("perfis", "id = $1 and nome = 'Escritório Contábil'", [c.contador])).toBe(1);
    }));

  it("a gestora não muda o nome de quem tem acesso ativo; o resto do cadastro, sim", () =>
    cenario(async (c) => {
      const f3 = (await db.query("select funcionaria_id from perfis where id = $1", [c.desativada])).rows[0].funcionaria_id as string;
      await como(c.gestora, async () => {
        expect(await falha("update funcionarias set nome_exibicao = 'Apelido' where id = $1", [c.f1.id])).toMatch(/própria funcionária/);
        expect(await afetadas("update funcionarias set nome = '[teste] F1 Completo', carga_sex_min = 420 where id = $1", [c.f1.id])).toBe(1);
        // Acesso desativado: o nome volta a ser da gestora.
        expect(await afetadas("update funcionarias set nome_exibicao = 'Sem acesso' where id = $1", [f3])).toBe(1);
      });
    }));

  it("funcionária não altera perfil nem cadastro direto", () =>
    cenario(async (c) => {
      await como(c.f1.uid, async () => {
        expect(await afetadas("update perfis set nome = 'x', papel = 'gestora' where id = $1", [c.f1.uid])).toBe(0);
        expect(await afetadas("update funcionarias set nome_exibicao = 'x' where id = $1", [c.f1.id])).toBe(0);
      });
    }));
});

describe("criar perfil de um login novo", () => {
  const novoLogin = async () => {
    const id = (await db.query("insert into auth.users (id, email, aud, role) values (gen_random_uuid(), gen_random_uuid() || '@teste.invalid', 'authenticated', 'authenticated') returning id"))
      .rows[0].id as string;
    return id;
  };
  const novaFuncionaria = async () =>
    (await db.query("insert into funcionarias (nome, nome_exibicao) values ('[teste] Nova Completa', '[teste] Nova') returning id")).rows[0].id as string;

  it("gestora cria; o perfil de funcionária nasce com o nome do cadastro", () =>
    cenario(async (c) => {
      const [u1, u2, u3, u4, fid] = [await novoLogin(), await novoLogin(), await novoLogin(), await novoLogin(), await novaFuncionaria()];
      await como(c.gestora, async () => {
        await db.query("select public.criar_perfil($1, 'ignorado', 'funcionaria', $2)", [u1, fid]);
        await db.query("select public.criar_perfil($1, 'Escritório', 'contador', null)", [u2]);
        expect(await falha("select public.criar_perfil($1, 'x', 'funcionaria', $2)", [u3, fid])).toMatch(/já tem acesso/);
        expect(await falha("select public.criar_perfil($1, 'x', 'contador', null)", [u2])).toMatch(/já tem perfil/);
        expect(await falha("select public.criar_perfil($1, 'x', 'contador', $2)", [u4, fid])).toMatch(/Só perfil de funcionária/);
      });
      expect(await contar("perfis", "id = $1 and nome = '[teste] Nova' and papel = 'funcionaria' and funcionaria_id = $2 and ativo", [u1, fid])).toBe(1);
      expect(await contar("perfis", "id = $1 and papel = 'contador'", [u2])).toBe(1);
    }));

  it("ninguém além da gestora cria, e funcionária inativa não ganha acesso", () =>
    cenario(async (c) => {
      const u = await novoLogin();
      const fid = await novaFuncionaria();
      for (const quem of [c.f1.uid, c.contador]) {
        await como(quem, async () => {
          expect(await falha("select public.criar_perfil($1, 'x', 'gestora', null)", [u])).toMatch(/Apenas a gestora/);
        });
      }
      await db.query("update funcionarias set ativa = false where id = $1", [fid]);
      await como(c.gestora, async () => {
        expect(await falha("select public.criar_perfil($1, 'x', 'funcionaria', $2)", [u, fid])).toMatch(/inativa/);
      });
    }));
});

describe("acessos", () => {
  it("não deixa bloquear nem rebaixar a última gestora com acesso", () =>
    cenario(async (c) => {
      await db.query("update perfis set ativo = false where papel = 'gestora' and id <> $1", [c.gestora]);
      await como(c.gestora, async () => {
        expect(await falha("update perfis set ativo = false where id = $1", [c.gestora])).toMatch(/ao menos uma gestora/);
        expect(await falha("update perfis set papel = 'contador' where id = $1", [c.gestora])).toMatch(/ao menos uma gestora/);
        expect(await afetadas("update perfis set ativo = false where id = $1", [c.contador])).toBe(1);
      });
    }));
});

describe("feriados", () => {
  it("não entra nem sai feriado de semana fechada", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        expect(await falha("insert into feriados (data, nome, tipo) values ('2031-02-25', 'Aniversário da cidade', 'municipal')")).toMatch(/já foi fechada/);
        await db.query("insert into feriados (data, nome, tipo) values ($1, 'Ponte', 'ponte')", [TERCA]);
        expect(await afetadas("delete from feriados where data = $1", [TERCA])).toBe(1);
      });
    }));

  it("só a gestora cadastra feriado", () =>
    cenario(async (c) => {
      for (const quem of [c.f1.uid, c.contador]) {
        await como(quem, async () => {
          expect(await falha("insert into feriados (data, nome, tipo) values ($1, 'x', 'ponte')", [TERCA])).toMatch(/row-level security/);
        });
      }
    }));
});

describe("regras de jornada", () => {
  it("valem a partir da primeira semana não fechada; salvar de novo substitui", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        const { rows } = await definir();
        expect(new Date(rows[0].desde).toISOString().slice(0, 10)).toBe(SEGUNDA); // a fechada do cenário é 24/02/2031
        await definir({ ...REGRAS, tolerancia_atraso_min: 15 });
      });
      expect(await contar("regras_ponto", "vigente_desde = $1", [SEGUNDA])).toBe(1);
      expect(await contar("regras_ponto", "vigente_desde = $1 and tolerancia_atraso_min = 15 and carga_seg_qui_min = 510 and criado_por = $2", [SEGUNDA, c.gestora])).toBe(1);
    }));

  it("versão marcada para depois fica para trás", () =>
    cenario(async (c) => {
      await db.query("insert into regras_ponto (vigente_desde) values ('2031-03-17')");
      await como(c.gestora, () => definir());
      expect(await contar("regras_ponto", "vigente_desde > $1", [SEGUNDA])).toBe(0);
    }));

  it("só a gestora muda, e valor fora da faixa é recusado", () =>
    cenario(async (c) => {
      for (const quem of [c.f1.uid, c.contador]) {
        await como(quem, async () => {
          expect(await falha("select public.definir_regras($1::jsonb)", [JSON.stringify(REGRAS)])).toMatch(/Apenas a gestora/);
        });
      }
      await como(c.gestora, async () => {
        expect(await falha("select public.definir_regras($1::jsonb)", [JSON.stringify({ ...REGRAS, almoco_padrao_min: 500 })])).toMatch(/check constraint/);
      });
    }));
});
