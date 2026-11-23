/** Pedidos de correção: o que a aprovação lança no dia e o que a funcionária vê como pendência. */
import { describe, expect, it } from "vitest";

import { descricaoDoPedido, pendenciasParaFuncionaria, planoDeAprovacao } from "@/lib/ponto/solicitacoes";

import { batidas, dia, lanc, seg, SEGUNDA } from "./ponto/ajuda";

describe("planoDeAprovacao", () => {
  it("batida que falta no dia → adicionar, com o tipo pedido", () => {
    const d = dia(SEGUNDA, ["07:01", "12:19", "17:00"], { iomd: [0, 1, 3] });
    const plano = planoDeAprovacao(d, { tipo_batida: "V", hora_seg: seg("13:15"), ocorrencia: null });
    expect(plano.lancamento).toEqual({ tipo: "adicionar_batida", hora_seg: seg("13:15"), tipo_batida: "V" });
    expect(plano.descricao).toBe("Adiciona a volta do almoço às 13:15");
  });

  it("batida que já existe com outro horário → alterar a da catraca (o original fica visível)", () => {
    const bat = batidas(["07:00", "12:15", "13:15", "16:10"]);
    const d = dia(SEGUNDA, [], { bat });
    const plano = planoDeAprovacao(d, { tipo_batida: "S", hora_seg: seg("17:15"), ocorrencia: null });
    expect(plano.lancamento).toEqual({ tipo: "alterar_horario", batida_id: bat[3]!.id, hora_seg: seg("17:15") });
    expect(plano.descricao).toBe("Altera a saída de 16:10 para 17:15");
  });

  it("batida que existe por lançamento manual → altera o lançamento, não a catraca", () => {
    const manual = lanc({ tipo: "adicionar_batida", horaSeg: seg("13:19"), tipoBatida: "V" });
    const d = dia(SEGUNDA, ["07:01", "12:19", "17:00"], { iomd: [0, 1, 3], lancamentos: [manual] });
    const plano = planoDeAprovacao(d, { tipo_batida: "V", hora_seg: seg("13:10"), ocorrencia: null });
    expect(plano.lancamento).toEqual({ tipo: "alterar_horario", lancamento_alvo_id: manual.id, hora_seg: seg("13:10") });
  });

  it("ocorrência → lança a ocorrência no dia", () => {
    const d = dia(SEGUNDA, []);
    const plano = planoDeAprovacao(d, { tipo_batida: null, hora_seg: null, ocorrencia: "atestado" });
    expect(plano.lancamento).toEqual({ tipo: "ocorrencia", ocorrencia: "atestado" });
    expect(plano.descricao).toBe("Lança atestado no dia");
  });

  it("descrição do pedido para as listas", () => {
    expect(descricaoDoPedido({ tipo_batida: "A", hora_seg: seg("12:00"), ocorrencia: null })).toBe("Saída para almoço às 12:00");
    expect(descricaoDoPedido({ tipo_batida: null, hora_seg: null, ocorrencia: "falta_justificada" })).toBe("Falta justificada");
  });
});

describe("pendenciasParaFuncionaria", () => {
  it("só o que bloqueia, em linguagem dela, com a batida a pedir já escolhida", () => {
    const esqueceu = dia(SEGUNDA, ["07:01", "12:19", "17:00"], { iomd: [0, 1, 3] });
    const atrasou = dia("2026-02-03", ["07:40", "12:00", "13:00", "17:00"]); // atraso é aviso: fica com a gestora
    expect(atrasou.pendencias.map((p) => p.codigo)).toContain("ATRASO");
    expect(pendenciasParaFuncionaria([esqueceu, atrasou])).toEqual([
      {
        data: SEGUNDA,
        codigo: "FALTA_VOLTA_ALMOCO",
        texto: "Você esqueceu de bater a volta do almoço em 02/02.",
        batidas: ["07:01", "12:19", "17:00"],
        tipoSugerido: "V",
      },
    ]);
  });

  it("pendência resolvida pela gestora some", () => {
    const d = dia(SEGUNDA, ["07:01", "12:19", "17:00"], { iomd: [0, 1, 3] });
    const resolvido = dia(SEGUNDA, ["07:01", "12:19", "17:00"], {
      iomd: [0, 1, 3],
      lancamentos: [lanc({ tipo: "resolver_pendencia", codigo: "FALTA_VOLTA_ALMOCO", assinatura: d.assinatura })],
    });
    expect(pendenciasParaFuncionaria([resolvido])).toEqual([]);
  });
});
