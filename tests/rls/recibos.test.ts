/**
 * Recibos (0.9): saldo do orçamento, quitação exata, só orçamento aprovado, cancelamento, numeração e acesso
 * (contador só lê). Tudo em transação com ROLLBACK (ver tests/rls/banco.ts).
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { afetadas, type Cenario, cenario, como, contar, db, falha, HOJE, usarBanco } from "./banco";

usarBanco();

/** Orçamento da gestora com total `total` centavos, na situação pedida. */
async function orcamento(c: Cenario, total: number, situacao: "rascunho" | "enviado" | "aprovado" = "aprovado") {
  const cliente = (await db.query("insert into clientes (nome, telefone) values ('[teste] Cliente Recibo', '') returning id")).rows[0].id as string;
  return como(c.gestora, async () => {
    const o = (await db.query("insert into orcamentos (cliente_id) values ($1) returning id, numero", [cliente])).rows[0] as { id: string; numero: number };
    const amb = randomUUID();
    await db.query("select public.salvar_orcamento($1, $2::jsonb, $3::jsonb, $4::jsonb)", [
      o.id,
      JSON.stringify({
        cliente_id: cliente,
        endereco_obra: "",
        validade_dias: 30,
        prazo_entrega: "",
        condicoes_pagamento: "",
        desconto_modo: "pct",
        desconto_valor: 0,
        deslocamento_centavos: 0,
        subtotal_centavos: total,
        desconto_centavos: 0,
        total_centavos: total,
        obs_cliente: "",
        obs_interna: "",
      }),
      JSON.stringify([{ id: amb, ordem: 0, nome: "Sala" }]),
      JSON.stringify([
        {
          id: randomUUID(),
          ambiente_id: amb,
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
          linhas: [],
          descricao: "Serviço",
          medidas: "",
          unitario_centavos: total,
          total_centavos: total,
        },
      ]),
    ]);
    if (situacao !== "rascunho") await db.query("update orcamentos set status = 'enviado' where id = $1", [o.id]);
    if (situacao === "aprovado") await db.query("update orcamentos set status = 'aprovado' where id = $1", [o.id]);
    return { ...o, cliente };
  });
}

const emitir = (orcamentoId: string | null, tipo: string, valor: number, data = HOJE) =>
  db.query(
    `insert into recibos (tipo, orcamento_id, pagador, referente, valor_centavos, forma, data_pagamento) values ($1, $2, '[teste] Pagador', 'Teste de recibo', $3, 'pix', ${data}) returning id, numero, orcamento_numero, cliente_id`,
    [tipo, orcamentoId, valor],
  );

describe("emissão", () => {
  it("saldo do orçamento: sinal, valor acima do saldo recusado, quitação só do saldo exato", () =>
    cenario(async (c) => {
      const o = await orcamento(c, 100000);
      await como(c.gestora, async () => {
        const r = (await emitir(o.id, "sinal", 50000)).rows[0];
        expect(r).toMatchObject({ orcamento_numero: o.numero, cliente_id: o.cliente });
        expect(await falha(`insert into recibos (tipo, orcamento_id, pagador, referente, valor_centavos, forma, data_pagamento) values ('parcela', $1, 'P', 'Teste', 60000, 'pix', ${HOJE})`, [o.id])).toMatch(
          /maior que o saldo .*R\$ 500,00/,
        );
        expect(await falha(`insert into recibos (tipo, orcamento_id, pagador, referente, valor_centavos, forma, data_pagamento) values ('quitacao', $1, 'Pa', 'Teste', 40000, 'pix', ${HOJE})`, [o.id])).toMatch(
          /saldo inteiro do orçamento \(R\$ 500,00\)/,
        );
        await emitir(o.id, "quitacao", 50000);
        expect((await db.query("select pago_centavos, saldo_centavos from saldos_orcamentos where orcamento_id = $1", [o.id])).rows[0]).toEqual({ pago_centavos: 100000, saldo_centavos: 0 });
        expect(await falha(`insert into recibos (tipo, orcamento_id, pagador, referente, valor_centavos, forma, data_pagamento) values ('parcela', $1, 'Pa', 'Teste', 1, 'pix', ${HOJE})`, [o.id])).toMatch(/maior que o saldo/);
      });
    }));

  it("só orçamento aprovado recebe recibo; data futura recusada; avulso sem orçamento", () =>
    cenario(async (c) => {
      const enviado = await orcamento(c, 10000, "enviado");
      const aprovado = await orcamento(c, 10000);
      await como(c.gestora, async () => {
        expect(await falha(`insert into recibos (tipo, orcamento_id, pagador, referente, valor_centavos, forma, data_pagamento) values ('sinal', $1, 'Pa', 'Teste', 100, 'pix', ${HOJE})`, [enviado.id])).toMatch(
          /Só orçamento aprovado/,
        );
        expect(await falha(`insert into recibos (tipo, orcamento_id, pagador, referente, valor_centavos, forma, data_pagamento) values ('sinal', $1, 'Pa', 'Teste', 100, 'pix', ${HOJE} + 1)`, [aprovado.id])).toMatch(
          /não pode ser futura/,
        );
        expect(await falha(`insert into recibos (tipo, orcamento_id, pagador, referente, valor_centavos, forma, data_pagamento) values ('avulso', $1, 'Pa', 'Teste', 100, 'pix', ${HOJE})`, [aprovado.id])).toMatch(
          /recibo_avulso_sem_orcamento/,
        );
        expect(await falha(`insert into recibos (tipo, pagador, referente, valor_centavos, forma, data_pagamento) values ('sinal', 'Pa', 'Teste', 100, 'pix', ${HOJE})`)).toMatch(/recibo_avulso_sem_orcamento/);
        const av = (await emitir(null, "avulso", 15000)).rows[0];
        expect(av.orcamento_numero).toBeNull();
      });
    }));

  it("numeração sem buraco, inclusive com transação desfeita, e o número não é escolhido", () =>
    cenario(async (c) => {
      await como(c.gestora, async () => {
        const n1 = (await db.query(`insert into recibos (numero, tipo, pagador, referente, valor_centavos, forma, data_pagamento) values (999999, 'avulso', 'Pa', 'Teste', 100, 'pix', ${HOJE}) returning numero`)).rows[0]
          .numero as number;
        expect(n1).not.toBe(999999);
        await db.query("savepoint desfaz");
        await emitir(null, "avulso", 100);
        await db.query("rollback to savepoint desfaz");
        expect((await emitir(null, "avulso", 100)).rows[0].numero).toBe(n1 + 1);
        expect(await falha("select public.definir_proximo_numero('recibo', $1)", [n1])).toMatch(/precisa ser maior/);
        await db.query("select public.definir_proximo_numero('recibo', $1)", [n1 + 50]);
        expect((await emitir(null, "avulso", 100)).rows[0].numero).toBe(n1 + 50);
      });
    }));
});

describe("cancelamento", () => {
  it("só cancela com motivo; cancelado não muda; o saldo volta; emitido não muda de valor", () =>
    cenario(async (c) => {
      const o = await orcamento(c, 20000);
      await como(c.gestora, async () => {
        const r = (await emitir(o.id, "quitacao", 20000)).rows[0];
        expect(await falha("update recibos set valor_centavos = 10 where id = $1", [r.id])).toMatch(/cancele e emita outro/);
        expect(await falha("update recibos set status = 'cancelado' where id = $1", [r.id])).toMatch(/motivo do cancelamento/);
        expect(await afetadas("update recibos set status = 'cancelado', motivo_cancelamento = 'Valor digitado errado' where id = $1", [r.id])).toBe(1);
        expect(await contar("recibos", "id = $1 and cancelado_por = $2 and cancelado_em is not null", [r.id, c.gestora])).toBe(1);
        expect(await falha("update recibos set motivo_cancelamento = 'outro' where id = $1", [r.id])).toMatch(/cancelado não muda/);
        await emitir(o.id, "quitacao", 20000); // o saldo voltou
        expect(await falha("delete from recibos where id = $1", [r.id])).toMatch(/permission denied/);
      });
    }));

  it("orçamento com recibo emitido não desfaz a aprovação; sem recibo emitido, desfaz", () =>
    cenario(async (c) => {
      const o = await orcamento(c, 20000);
      await como(c.gestora, async () => {
        const r = (await emitir(o.id, "sinal", 5000)).rows[0];
        expect(await falha("update orcamentos set status = 'enviado' where id = $1", [o.id])).toMatch(/tem recibo emitido/);
        await db.query("update recibos set status = 'cancelado', motivo_cancelamento = 'Desistiu' where id = $1", [r.id]);
        expect(await afetadas("update orcamentos set status = 'enviado' where id = $1", [o.id])).toBe(1);
      });
    }));
});

describe("acesso", () => {
  it("contador lê os recibos e não emite nem cancela; funcionária e anônimo não veem", () =>
    cenario(async (c) => {
      const o = await orcamento(c, 20000);
      const r = await como(c.gestora, async () => (await emitir(o.id, "sinal", 5000)).rows[0]);
      await como(c.contador, async () => {
        expect(await contar("recibos", "id = $1 and orcamento_numero is not null", [r.id])).toBe(1);
        expect(await contar("saldos_orcamentos")).toBe(0); // orçamento e cliente continuam só da gestora
        expect(await falha(`insert into recibos (tipo, pagador, referente, valor_centavos, forma, data_pagamento) values ('avulso', 'Pa', 'Teste', 100, 'pix', ${HOJE})`)).toMatch(/row-level security/);
        expect(await afetadas("update recibos set status = 'cancelado', motivo_cancelamento = 'xyz' where id = $1", [r.id])).toBe(0);
      });
      for (const quem of [c.f1.uid, c.semPerfil, c.desativada]) {
        await como(quem, async () => {
          expect(await contar("recibos")).toBe(0);
        });
      }
      await como(null, async () => {
        expect(await falha("select count(*) from recibos")).toMatch(/permission denied/);
      });
    }));
});
