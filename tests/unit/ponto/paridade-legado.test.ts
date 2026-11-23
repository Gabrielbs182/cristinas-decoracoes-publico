/**
 * Casos de referência portados de Pontos/tests/test_calculos.py e test_relatorio.py.
 * A conta de horas tem que bater com o script legado, sem tolerância.
 */
import { describe, expect, it } from "vitest";

import { contaLegado, hhmm, REGRAS_PADRAO, resumoBanco } from "@/lib/ponto";

import { dia, QUINTA, seg, SEXTA } from "./ajuda";

const conta = (horas: string[]) => contaLegado(horas.map(seg), 60).trabalhadasMin;

describe("conta de horas (paridade com calculos.py)", () => {
  it("0 batidas: falta, extra 00:00", () => {
    const r = dia(QUINTA, []);
    expect(r.trabalhadasMin).toBeNull();
    expect(r.extraMin).toBe(0);
    expect(r.situacao).toBe("falta");
  });

  it("4 batidas, almoço de 60 min, quinta: 09:00 e 0 extra", () => {
    const r = dia(QUINTA, ["07:00", "12:00", "13:00", "17:00"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("09:00");
    expect(r.extraMin).toBe(0);
  });

  it("almoço curto de 30 min: a diferença é descontada (conta como 1h)", () => {
    const r = dia(QUINTA, ["07:00", "12:00", "12:30", "17:00"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("09:00");
    expect(r.extraMin).toBe(0);
  });

  it("almoço longo de 90 min: sem desconto extra, tarde encurtada", () => {
    const r = dia(QUINTA, ["07:00", "12:00", "13:30", "17:00"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("08:30");
    expect(r.extraMin).toBe(0);
  });

  it("sexta tem carga de 8h: 8h trabalhadas, 0 extra", () => {
    const r = dia(SEXTA, ["07:00", "12:00", "13:00", "16:00"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("08:00");
    expect(r.extraMin).toBe(0);
  });

  it("sexta com 9h: 1h extra", () => {
    const r = dia(SEXTA, ["07:00", "12:00", "13:00", "17:00"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("09:00");
    expect(hhmm(r.extraMin)).toBe("01:00");
  });

  it("quinta com 10h: 1h extra", () => {
    const r = dia(QUINTA, ["07:00", "12:00", "13:00", "18:00"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("10:00");
    expect(hhmm(r.extraMin)).toBe("01:00");
  });

  it("3 batidas sem saída: conta só a manhã", () => {
    const r = dia(QUINTA, ["07:00", "12:00", "13:00"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("05:00");
    expect(r.extraMin).toBe(0);
  });

  it("2 batidas entrada e saída: período inteiro", () => {
    const r = dia(QUINTA, ["07:00", "17:00"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("10:00");
    expect(hhmm(r.extraMin)).toBe("01:00");
  });

  it("1 batida: falta", () => {
    const r = dia(QUINTA, ["07:00"]);
    expect(r.trabalhadasMin).toBeNull();
    expect(r.extraMin).toBe(0);
  });

  it("dia abaixo da carga não desconta (extra mínima 0)", () => {
    const r = dia(QUINTA, ["07:00", "12:00", "13:00", "16:57"]);
    expect(hhmm(r.trabalhadasMin!)).toBe("08:57");
    expect(r.extraMin).toBe(0);
  });

  it("segundos são truncados como no calc_interval do legado", () => {
    expect(conta(["07:00:30", "12:00:10"])).toBe(299);
  });

  it("mais de 4 batidas: usa as 4 primeiras", () => {
    expect(conta(["07:00", "12:00", "13:00", "17:00", "17:40"])).toBe(540);
  });
});

describe("banco de horas (paridade com relatorio.py)", () => {
  const r = REGRAS_PADRAO;

  it("K=07:45, L=00:05 → M=07:50 fecha na tolerância, N=00:00", () => {
    const b = resumoBanco(r, 465, 5);
    expect(hhmm(b.acumuladoMin)).toBe("07:50");
    expect(b.fechouCorte).toBe(true);
    expect(hhmm(b.proximaSemanaMin)).toBe("00:00");
  });

  it("K=07:45, L=00:04 → M=07:49 não fecha, rola tudo", () => {
    const b = resumoBanco(r, 465, 4);
    expect(b.fechouCorte).toBe(false);
    expect(hhmm(b.proximaSemanaMin)).toBe("07:49");
  });

  it("K=07:30, L=01:00 → M=08:30 fecha, N=00:30", () => {
    const b = resumoBanco(r, 450, 60);
    expect(b.fechouCorte).toBe(true);
    expect(hhmm(b.proximaSemanaMin)).toBe("00:30");
  });

  it("tolerância configurável: com 5 min, 07:53 não fecha e 07:55 fecha", () => {
    const cinco = { ...r, toleranciaCorteMin: 5 };
    expect(resumoBanco(cinco, 473, 0).fechouCorte).toBe(false);
    expect(resumoBanco(cinco, 475, 0).fechouCorte).toBe(true);
  });
});
