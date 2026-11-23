/**
 * Leitor do arquivo bruto da catraca (001_GLog.txt).
 *
 * Linha 1 é cabeçalho (com TABs duplos); dados separados por TAB único:
 *   No  Mchn  EnNo  Name  Mode  IOMd  DateTime("YYYY/MM/DD  HH:MM:SS")
 * Matching é sempre por EnNo; o Name é descartado. Port de pontos/parser.py,
 * com a diferença de que linhas ruins são devolvidas (para a prévia) em vez de só logadas.
 */

export interface BatidaLida {
  linha: number;
  enNo: string;
  iomd: number;
  data: string; // YYYY-MM-DD
  horaSeg: number;
}

export interface LinhaComErro {
  linha: number;
  conteudo: string;
  motivo: string;
}

export interface LeituraGlog {
  batidas: BatidaLida[];
  erros: LinhaComErro[];
  /** Linhas de dados (sem cabeçalho e sem linhas vazias). */
  linhasLidas: number;
}

const DATA_HORA = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export function lerGlog(conteudo: string): LeituraGlog {
  const linhas = conteudo.replace(/^﻿/, "").split(/\r?\n/);
  const batidas: BatidaLida[] = [];
  const erros: LinhaComErro[] = [];
  let linhasLidas = 0;
  // O legado sempre pulava a linha 1; um arquivo sem cabeçalho perdia a primeira batida calado.
  const temCabecalho = /EnNo|DateTime/i.test(linhas[0] ?? "");

  linhas.forEach((bruta, i) => {
    const numero = i + 1;
    if (numero === 1 && temCabecalho) return;
    if (!bruta.trim()) return;
    linhasLidas++;

    const campos = bruta.split("\t");
    if (campos.length < 7) {
      erros.push({ linha: numero, conteudo: bruta, motivo: `Linha incompleta (${campos.length} campos de 7)` });
      return;
    }

    const enNoBruto = campos[2]!.trim();
    if (!/^\d{1,9}$/.test(enNoBruto)) {
      erros.push({ linha: numero, conteudo: bruta, motivo: "ID da funcionária inválido" });
      return;
    }

    const iomdBruto = campos[5]!.trim();
    if (!/^\d+$/.test(iomdBruto)) {
      erros.push({ linha: numero, conteudo: bruta, motivo: "Código de tipo inválido" });
      return;
    }

    const dh = DATA_HORA.exec(campos[6]!.replace(/\s+/g, " ").trim());
    if (!dh) {
      erros.push({ linha: numero, conteudo: bruta, motivo: "Data e hora em formato inesperado" });
      return;
    }
    const [, a, m, d, hh, mm, ss] = dh.map(Number) as [number, number, number, number, number, number, number];
    const valida = new Date(Date.UTC(a, m - 1, d));
    if (valida.getUTCFullYear() !== a || valida.getUTCMonth() !== m - 1 || valida.getUTCDate() !== d) {
      erros.push({ linha: numero, conteudo: bruta, motivo: "Data inválida" });
      return;
    }
    if (hh > 23 || mm > 59 || ss > 59) {
      erros.push({ linha: numero, conteudo: bruta, motivo: "Hora inválida" });
      return;
    }

    batidas.push({
      linha: numero,
      enNo: enNoBruto.padStart(9, "0"),
      iomd: Number(iomdBruto),
      data: `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      horaSeg: hh * 3600 + mm * 60 + ss,
    });
  });

  return { batidas, erros, linhasLidas };
}
