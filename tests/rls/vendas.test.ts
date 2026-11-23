/**
 * Clientes e catálogo (0.7): só a gestora vê e mexe; travas de unidade, documento e exclusão.
 * Tudo em transação com ROLLBACK (ver tests/rls/banco.ts).
 */
import { describe, expect, it } from "vitest";

import { afetadas, cenario, como, contar, db, falha, usarBanco } from "./banco";

usarBanco();

const TABELAS = ["clientes", "produtos", "modelos_confeccao", "regras_orcamento"];

const montarVendas = async () => {
  const cliente = (await db.query("insert into clientes (nome, telefone, documento) values ('[teste] Cliente', '(19) 99999-0000', '31244892017') returning id")).rows[0].id as string;
  const produto = (await db.query("insert into produtos (categoria, nome, unidade, preco_centavos, largura_rolo_cm) values ('tecido', '[teste] Linho', 'm', 8990, 280) returning id")).rows[0]
    .id as string;
  await db.query("insert into modelos_confeccao (nome, fator_franzimento, preco_metro_centavos) values ('[teste] Wave', 2.5, 2800)");
  return { cliente, produto };
};

describe("vendas: só a gestora", () => {
  it("contador, funcionária, sem perfil e anônimo não veem nem gravam nada", () =>
    cenario(async (c) => {
      await montarVendas();
      for (const quem of [c.contador, c.f1.uid, c.semPerfil, c.desativada]) {
        await como(quem, async () => {
          for (const t of TABELAS) expect(await contar(t), `${t} visível`).toBe(0);
          expect(await falha("insert into clientes (nome) values ('Intrusa')")).toMatch(/row-level security/);
          expect(await afetadas("update regras_orcamento set sobra_trilho_cm = 50")).toBe(0);
          expect(await afetadas("delete from clientes")).toBe(0);
        });
      }
      await como(null, async () => {
        expect(await falha("select count(*) from clientes")).toMatch(/permission denied/);
      });
    }));

  it("a gestora cadastra, edita e exclui cliente; produto ela só inativa", () =>
    cenario(async (c) => {
      const { cliente, produto } = await montarVendas();
      await como(c.gestora, async () => {
        expect(await contar("clientes", "nome like '[teste]%'")).toBe(1);
        expect(await afetadas("update clientes set obra_endereco = 'R. das Hortênsias, 240' where id = $1", [cliente])).toBe(1);
        expect(await afetadas("update produtos set preco_centavos = 9490, ativo = false where id = $1", [produto])).toBe(1);
        expect(await afetadas("update regras_orcamento set sobra_trilho_cm = 25")).toBe(1);
        expect(await falha("delete from produtos where id = $1", [produto])).toMatch(/permission denied/);
        expect(await afetadas("delete from clientes where id = $1", [cliente])).toBe(1);
      });
    }));
});

describe("vendas: travas do banco", () => {
  it("a unidade segue a categoria e o rolo é só de tecido", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        expect(await falha("insert into produtos (categoria, nome, unidade, preco_centavos) values ('persiana', 'Rolô', 'm', 18900)")).toMatch(/produto_unidade_da_categoria/);
        expect(await falha("insert into produtos (categoria, nome, unidade, preco_centavos, largura_rolo_cm) values ('trilho', 'Suíço', 'm', 5800, 280)")).toMatch(/produto_rolo_so_tecido/);
        await db.query("insert into produtos (categoria, nome, unidade, preco_centavos) values ('servico', '[teste] Instalação', 'vao', 6000)");
        expect(await falha("insert into produtos (categoria, nome, unidade, preco_centavos) values ('servico', ' [TESTE] instalação ', 'un', 7000)")).toMatch(/produtos_nome_unico/);
        expect(await falha("insert into produtos (categoria, nome, unidade, preco_centavos) values ('acessorio', 'Motor', 'un', -1)")).toMatch(/check constraint/);
      });
    }));

  it("documento só com 11 ou 14 dígitos; fator de franzimento de 1 a 4", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        expect(await falha("insert into clientes (nome, documento) values ('X Y', '312.448.920-17')")).toMatch(/check constraint/);
        expect(await falha("insert into clientes (nome, documento) values ('X Y', '1234')")).toMatch(/check constraint/);
        await db.query("insert into clientes (nome, documento) values ('[teste] Empresa', '12345678000190')");
        expect(await falha("insert into modelos_confeccao (nome, fator_franzimento, preco_metro_centavos) values ('Exagero', 5, 100)")).toMatch(/check constraint/);
      });
    }));

  it("regras são uma linha só e atualizado_em acompanha a mudança", () =>
    cenario(async (c) => {
      expect(await contar("regras_orcamento")).toBe(1);
      await como(c.gestora, async () => {
        expect(await falha("insert into regras_orcamento (id) values (true)")).toMatch(/permission denied/);
        await db.query("update regras_orcamento set area_minima_persiana_cm2 = 12000");
      });
      expect(await contar("regras_orcamento", "atualizado_em = now() and atualizado_por is not null")).toBe(1);
    }));
});
