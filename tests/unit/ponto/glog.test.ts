/** Leitor do GLog — port de Pontos/tests/test_parser.py, mais o relatório de linhas com erro. */
import { describe, expect, it } from "vitest";

import { lerGlog } from "@/lib/ponto";

const CAB = "No\tMchn\tEnNo\t\tName\t\tMode\tIOMd\tDateTime\t";
const linha = (no: string, enNo: string, iomd: string, dh: string, nome = "Fulana A      ") =>
  `${no}\t1\t${enNo}\t${nome}\t1\t${iomd}\t${dh}`;

describe("lerGlog", () => {
  it("lê as linhas, pula o cabeçalho e normaliza o ID para 9 dígitos", () => {
    const r = lerGlog([CAB, linha("000001", "000000005", "0", "2026/02/02  07:00:00"), linha("000002", "7", "1", "2026/02/02  12:19:00")].join("\n"));
    expect(r.linhasLidas).toBe(2);
    expect(r.erros).toEqual([]);
    expect(r.batidas).toEqual([
      { linha: 2, enNo: "000000005", iomd: 0, data: "2026-02-02", horaSeg: 25200 },
      { linha: 3, enNo: "000000007", iomd: 1, data: "2026-02-02", horaSeg: 44340 },
    ]);
  });

  it("tolera BOM, CRLF, linhas vazias e 1 a 3 espaços entre data e hora", () => {
    const txt = "﻿" + [CAB, linha("1", "5", "0", "2026/02/02 07:00:00"), "", linha("2", "5", "1", "2026/02/02   12:00:00"), ""].join("\r\n");
    const r = lerGlog(txt);
    expect(r.batidas.map((b) => b.horaSeg)).toEqual([25200, 43200]);
    expect(r.linhasLidas).toBe(2);
  });

  it("arquivo sem cabeçalho não perde a primeira batida (o legado perdia)", () => {
    const r = lerGlog([linha("1", "5", "0", "2026/02/02  07:00:00"), linha("2", "5", "1", "2026/02/02  12:00:00")].join("\n"));
    expect(r.batidas).toHaveLength(2);
  });

  it("devolve as linhas com problema em vez de descartá-las em silêncio", () => {
    const r = lerGlog(
      [
        CAB,
        "000001\t1\t000000005",
        linha("2", "5", "0", "2026/02/31  07:00:00"),
        linha("3", "5", "0", "2026/02/02  25:00:00"),
        linha("4", "abc", "0", "2026/02/02  07:00:00"),
        linha("5", "5", "0", "2026/02/02  07:00:00"),
      ].join("\n"),
    );
    expect(r.batidas).toHaveLength(1);
    expect(r.erros.map((e) => [e.linha, e.motivo])).toEqual([
      [2, "Linha incompleta (3 campos de 7)"],
      [3, "Data inválida"],
      [4, "Hora inválida"],
      [5, "ID da funcionária inválido"],
    ]);
  });
});
