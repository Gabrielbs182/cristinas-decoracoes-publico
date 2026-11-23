/**
 * Compara, dia a dia, a conta do script legado (Python) com o motor novo sobre um GLog real.
 *
 *   npm run paridade -- <arquivo GLog> [--sem-cabecalho]
 *   (PONTOS_DIR aponta para o projeto legado; padrão: ../Pontos)
 *
 * Diferença só é aceitável em dia com pendência que bloqueia: é onde o motor novo
 * deixa de aceitar em silêncio o que o legado aceitava.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { avaliarDia, hhmm, lerGlog, REGRAS_PADRAO } from "../lib/ponto";

const [arquivo, ...flags] = process.argv.slice(2);
if (!arquivo) {
  console.error("uso: npm run paridade -- <arquivo GLog> [--sem-cabecalho]");
  process.exit(2);
}
const semCabecalho = flags.includes("--sem-cabecalho");
const pontosDir = process.env.PONTOS_DIR ?? path.resolve("..", "Pontos");

type Legado = { en_no: string; data: string; trab: number | null; extra: number };
const legado: Legado[] = JSON.parse(
  execFileSync("python", ["scripts/legado_dump.py", pontosDir, arquivo, ...(semCabecalho ? ["--sem-cabecalho"] : [])], {
    encoding: "utf-8",
  }),
);

// O leitor novo detecta o cabeçalho sozinho; a flag só vale para o script Python.
const { batidas } = lerGlog(readFileSync(arquivo, "utf-8"));

let iguais = 0;
const esperadas: string[] = [];
const inesperadas: string[] = [];
let id = 1;
for (const l of legado) {
  const r = avaliarDia({
    data: l.data,
    regras: REGRAS_PADRAO,
    batidas: batidas.filter((b) => b.enNo === l.en_no && b.data === l.data).map((b) => ({ id: id++, horaSeg: b.horaSeg, iomd: b.iomd })),
    lancamentos: [],
  });
  const fmt = (t: number | null, e: number) => `${t === null ? "Falta" : hhmm(t)} (+${hhmm(e)})`;
  if (r.trabalhadasMin === l.trab && r.extraMin === l.extra) {
    iguais++;
    continue;
  }
  const linha = `${l.data} ID …${l.en_no.slice(-3)}: legado ${fmt(l.trab, l.extra)} · novo ${fmt(r.trabalhadasMin, r.extraMin)} · ${r.pendencias.map((p) => p.codigo).join(", ") || "sem pendência"}`;
  (r.pendencias.some((p) => p.severidade === "bloqueia") ? esperadas : inesperadas).push(linha);
}

const pendDias = legado.length;
console.log(`${path.basename(arquivo)}: ${pendDias} dias-funcionária · ${iguais} idênticos ao legado`);
for (const l of esperadas) console.log(`  diferença justificada (pendência que bloqueia): ${l}`);
for (const l of inesperadas) console.log(`  DIFERENÇA INESPERADA: ${l}`);
process.exit(inesperadas.length ? 1 : 0);
