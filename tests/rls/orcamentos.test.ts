/**
 * Orçamentos (0.8): numeração sem buraco, situação, trava depois do envio, acesso e o link da cliente.
 * Tudo em transação com ROLLBACK (ver tests/rls/banco.ts) — inclusive o contador da numeração.
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { afetadas, type Cenario, cenario, como, contar, db, falha, HOJE, usarBanco } from "./banco";

usarBanco();

async function cliente() {
  return (await db.query("insert into clientes (nome, telefone) values ('[teste] Cliente Orçamento', '(19) 90000-0000') returning id")).rows[0].id as string;
}

/** Orçamento da gestora, com um item pronto (para poder enviar). */
async function orcamento(c: Cenario, clienteId: string, comItem = true) {
  return como(c.gestora, async () => {
    const o = (await db.query("insert into orcamentos (cliente_id) values ($1) returning id, numero", [clienteId])).rows[0] as { id: string; numero: number };
    if (comItem) {
      const amb = randomUUID();
      await db.query("select public.salvar_orcamento($1, $2::jsonb, $3::jsonb, $4::jsonb)", [
        o.id,
        JSON.stringify(cabecalho(clienteId, 10000)),
        JSON.stringify([{ id: amb, ordem: 0, nome: "Sala" }]),
        JSON.stringify([item(amb, 10000)]),
      ]);
    }
    return o;
  });
}

const cabecalho = (clienteId: string, total: number) => ({
  cliente_id: clienteId,
  endereco_obra: "R. Teste, 1",
  validade_dias: 30,
  prazo_entrega: "20 dias úteis",
  condicoes_pagamento: "À vista",
  desconto_modo: "pct",
  desconto_valor: 0,
  deslocamento_centavos: 0,
  subtotal_centavos: total,
  desconto_centavos: 0,
  total_centavos: total,
  obs_cliente: "",
  obs_interna: "",
});

const item = (ambienteId: string, total: number) => ({
  id: randomUUID(),
  ambiente_id: ambienteId,
  ordem: 0,
  tipo: "servico",
  produto_id: null,
  modelo_id: null,
  trilho_id: null,
  motorizado: false,
  motor_id: null,
  instalacao_id: null,
  cor: "",
  largura_cm: null,
  altura_cm: null,
  quantidade: 1,
  precos: {},
  linhas: [{ rotulo: "Serviço", memoria: "1 vão", valor_centavos: total }],
  descricao: "Instalação",
  medidas: "",
  unitario_centavos: total,
  total_centavos: total,
});

const situacao = (id: string, status: string) => db.query("update orcamentos set status = $2 where id = $1", [id, status]);

describe("numeração", () => {
  it("números seguidos, sem buraco mesmo quando a transação é desfeita, e não dá para escolher o número", () =>
    cenario(async (c) => {
      const cli = await cliente();
      await como(c.gestora, async () => {
        const n1 = (await db.query("insert into orcamentos (cliente_id, numero) values ($1, 999999) returning numero", [cli])).rows[0].numero as number;
        expect(n1).not.toBe(999999);
        await db.query("savepoint desfaz");
        const perdido = (await db.query("insert into orcamentos (cliente_id) values ($1) returning numero", [cli])).rows[0].numero;
        await db.query("rollback to savepoint desfaz");
        const n2 = (await db.query("insert into orcamentos (cliente_id) values ($1) returning numero", [cli])).rows[0].numero;
        expect(perdido).toBe(n1 + 1);
        expect(n2).toBe(n1 + 1);
      });
    }));

  it("próximo número só para frente, e só a gestora muda", () =>
    cenario(async (c) => {
      const o = await orcamento(c, await cliente(), false);
      await como(c.gestora, async () => {
        expect(await falha("select public.definir_proximo_numero('orcamento', $1)", [o.numero])).toMatch(/precisa ser maior/);
        await db.query("select public.definir_proximo_numero('orcamento', $1)", [o.numero + 100]);
        expect((await db.query("insert into orcamentos (cliente_id) values ((select cliente_id from orcamentos where id = $1)) returning numero", [o.id])).rows[0].numero).toBe(o.numero + 100);
      });
      await como(c.contador, async () => {
        expect(await falha("select public.definir_proximo_numero('orcamento', 5000)")).toMatch(/Apenas a gestora/);
      });
    }));
});

describe("acesso", () => {
  it("só a gestora vê e grava orçamento; anon não chama as funções da gestora", () =>
    cenario(async (c) => {
      const o = await orcamento(c, await cliente());
      for (const quem of [c.contador, c.f1.uid, c.semPerfil, c.desativada]) {
        await como(quem, async () => {
          for (const t of ["orcamentos", "orcamento_ambientes", "orcamento_itens", "numeracao"]) expect(await contar(t), t).toBe(0);
          expect(await falha("select public.documento_orcamento($1)", [o.id])).toMatch(/Apenas a gestora/);
        });
      }
      await como(null, async () => {
        expect(await falha("select public.salvar_orcamento($1, '{}', '[]', '[]')", [o.id])).toMatch(/permission denied/);
        expect(await falha("select public.documento_orcamento($1)", [o.id])).toMatch(/permission denied/);
      });
    }));

  it("cliente com orçamento não pode ser excluído", () =>
    cenario(async (c) => {
      const cli = await cliente();
      await orcamento(c, cli, false);
      await como(c.gestora, async () => {
        expect(await falha("delete from clientes where id = $1", [cli])).toMatch(/foreign key/);
      });
    }));
});

describe("situação", () => {
  it("rascunho vazio não é enviado; enviado ganha validade e trava o conteúdo", () =>
    cenario(async (c) => {
      const cli = await cliente();
      const vazio = await orcamento(c, cli, false);
      const o = await orcamento(c, cli);
      await como(c.gestora, async () => {
        expect(await falha("update orcamentos set status = 'enviado' where id = $1", [vazio.id])).toMatch(/sem itens/);
        await situacao(o.id, "enviado");
        const { rows } = await db.query("select enviado_em is not null as enviado, valido_ate - (now() at time zone 'America/Sao_Paulo')::date as dias from orcamentos where id = $1", [o.id]);
        expect(rows[0]).toEqual({ enviado: true, dias: 30 });
        expect(await falha("update orcamentos set total_centavos = 1 where id = $1", [o.id])).toMatch(/não é mais rascunho/);
        expect(await falha("update orcamentos set status = 'aprovado', total_centavos = 1 where id = $1", [o.id])).toMatch(/conteúdo do orçamento não muda/);
        expect(await falha("select public.salvar_orcamento($1, $2::jsonb, '[]', '[]')", [o.id, JSON.stringify(cabecalho(cli, 0))])).toMatch(/volte para rascunho/);
        expect(await falha("delete from orcamento_itens where orcamento_id = $1", [o.id])).toMatch(/volte para rascunho/);
        expect(await afetadas("update orcamentos set obs_interna = 'Cliente pediu desconto' where id = $1", [o.id])).toBe(1);
      });
    }));

  it("fluxo: enviado → aprovado → desfazer → recusado → volta a rascunho; cancelado é final", () =>
    cenario(async (c) => {
      const cli = await cliente();
      const o = await orcamento(c, cli);
      const r = await orcamento(c, cli, false);
      await como(c.gestora, async () => {
        await situacao(o.id, "enviado");
        await situacao(o.id, "aprovado");
        expect(await contar("orcamentos", "id = $1 and respondido_em is not null", [o.id])).toBe(1);
        expect(await falha("update orcamentos set status = 'rascunho' where id = $1", [o.id])).toMatch(/não permitida/);
        await situacao(o.id, "enviado");
        await db.query("update orcamentos set status = 'recusado', resposta_motivo = 'Achou caro' where id = $1", [o.id]);
        await situacao(o.id, "rascunho");
        expect(await contar("orcamentos", "id = $1 and enviado_em is null and valido_ate is null and resposta_motivo = ''", [o.id])).toBe(1);
        await situacao(r.id, "cancelado");
        expect(await falha("update orcamentos set status = 'rascunho' where id = $1", [r.id])).toMatch(/não permitida/);
        expect(await falha("update orcamentos set numero = numero + 1000 where id = $1", [o.id])).toMatch(/não mudam/);
        expect(await falha("delete from orcamentos where id = $1", [o.id])).toMatch(/permission denied/);
      });
    }));

  it("salvar substitui ambientes e itens de uma vez", () =>
    cenario(async (c) => {
      const cli = await cliente();
      const o = await orcamento(c, cli);
      await como(c.gestora, async () => {
        const [a1, a2] = [randomUUID(), randomUUID()];
        await db.query("select public.salvar_orcamento($1, $2::jsonb, $3::jsonb, $4::jsonb)", [
          o.id,
          JSON.stringify(cabecalho(cli, 30000)),
          JSON.stringify([
            { id: a1, ordem: 0, nome: "Sala" },
            { id: a2, ordem: 1, nome: "Quarto" },
          ]),
          JSON.stringify([item(a1, 10000), item(a2, 20000)]),
        ]);
        expect(await contar("orcamento_ambientes", "orcamento_id = $1", [o.id])).toBe(2);
        expect(await contar("orcamento_itens", "orcamento_id = $1", [o.id])).toBe(2);
        expect(await contar("orcamentos", "id = $1 and total_centavos = 30000", [o.id])).toBe(1);
      });
    }));
});

describe("link da cliente", () => {
  it("rascunho não aparece; enviado aparece sem a observação interna e a cliente aprova uma vez", () =>
    cenario(async (c) => {
      const o = await orcamento(c, await cliente());
      await como(c.gestora, () => db.query("update orcamentos set obs_interna = 'segredo da loja', obs_cliente = 'Medidas conferidas' where id = $1", [o.id]));
      const token = (await db.query("select token from orcamentos where id = $1", [o.id])).rows[0].token as string;
      await como(null, async () => {
        expect((await db.query("select public.orcamento_publico($1) as d", [token])).rows[0].d).toBeNull();
      });
      await como(c.gestora, () => situacao(o.id, "enviado"));
      await como(null, async () => {
        const d = (await db.query("select public.orcamento_publico($1) as d", [token])).rows[0].d;
        expect(d).toMatchObject({ numero: o.numero, status: "enviado", vencido: false, obs_cliente: "Medidas conferidas", total_centavos: 10000 });
        expect(JSON.stringify(d)).not.toContain("segredo da loja");
        expect(d.ambientes[0].itens[0]).toMatchObject({ descricao: "Instalação", total_centavos: 10000 });
        expect((await db.query("select public.orcamento_publico($1) as d", [randomUUID()])).rows[0].d).toBeNull();
        await db.query("select public.aprovar_orcamento_publico($1)", [token]);
        await db.query("select public.aprovar_orcamento_publico($1)", [token]); // segundo toque: continua aprovado
        expect(await falha("select count(*) from orcamentos")).toMatch(/permission denied/);
      });
      expect(await contar("orcamentos", "id = $1 and status = 'aprovado' and aprovado_pelo_link", [o.id])).toBe(1);
    }));

  it("vencido não é aprovado pelo link", () =>
    cenario(async (c) => {
      const o = await orcamento(c, await cliente());
      await como(c.gestora, () => situacao(o.id, "enviado"));
      // Só o superusuário, com os gatilhos desligados, consegue "envelhecer" a validade para o teste.
      await db.query("set local session_replication_role = replica");
      await db.query(`update orcamentos set valido_ate = ${HOJE} - 1 where id = $1`, [o.id]);
      await db.query("set local session_replication_role = origin");
      const token = (await db.query("select token from orcamentos where id = $1", [o.id])).rows[0].token as string;
      await como(null, async () => {
        expect((await db.query("select public.orcamento_publico($1) as d", [token])).rows[0].d.vencido).toBe(true);
        expect(await falha("select public.aprovar_orcamento_publico($1)", [token])).toMatch(/venceu/);
      });
    }));

  // Decisão de 25/10/2026: o link (que mostra nome, telefone e endereço da obra) expira 30 dias depois de vencer.
  it("o link expira 30 dias depois de vencer, sem mostrar dado da cliente; aprovado continua", () =>
    cenario(async (c) => {
      const aberto = await orcamento(c, await cliente());
      const aprovado = await orcamento(c, await cliente());
      await como(c.gestora, async () => {
        await situacao(aberto.id, "enviado");
        await situacao(aprovado.id, "enviado");
        await situacao(aprovado.id, "aprovado");
      });
      const envelhecer = async (id: string, dias: number) => {
        await db.query("set local session_replication_role = replica");
        await db.query(`update orcamentos set valido_ate = ${HOJE} - ${dias} where id = $1`, [id]);
        await db.query("set local session_replication_role = origin");
      };
      const publico = async (id: string) => {
        const token = (await db.query("select token from orcamentos where id = $1", [id])).rows[0].token as string;
        return como(null, async () => (await db.query("select public.orcamento_publico($1) as d", [token])).rows[0].d);
      };
      await envelhecer(aberto.id, 30);
      expect(await publico(aberto.id)).toMatchObject({ vencido: true, numero: aberto.numero });
      await envelhecer(aberto.id, 31);
      const expirado = await publico(aberto.id);
      expect(expirado).toMatchObject({ expirado: true });
      expect(Object.keys(expirado).sort()).toEqual(["expirado", "expirou_em"]);
      await envelhecer(aprovado.id, 90);
      expect(await publico(aprovado.id)).toMatchObject({ status: "aprovado", numero: aprovado.numero });
    }));
});
