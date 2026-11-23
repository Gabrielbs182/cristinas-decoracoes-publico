/** O roadmap é a fonte única da versão: package.json, tela e ROADMAP.md não podem divergir. */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import pacote from "@/package.json";
import { ROADMAP, roadmapMarkdown, versaoAtual } from "@/lib/roadmap";

const numeros = (v: string) => v.split(".").map(Number) as [number, number, number];
const maior = (a: string, b: string) => {
  const [x, y] = [numeros(a), numeros(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

describe("versionamento", () => {
  it("a versão do package.json é a última versão lançada do roadmap", () => {
    expect(pacote.version).toBe(versaoAtual().versao);
  });

  it("versões em ordem crescente, lançadas antes das futuras, só uma 'próxima'", () => {
    for (let i = 1; i < ROADMAP.length; i++) expect(maior(ROADMAP[i]!.versao, ROADMAP[i - 1]!.versao)).toBeGreaterThan(0);
    const status = ROADMAP.map((v) => v.status);
    expect(status.lastIndexOf("lancada")).toBeLessThan(status.indexOf("proxima") === -1 ? Infinity : status.indexOf("proxima"));
    expect(status.filter((s) => s === "proxima").length).toBeLessThanOrEqual(1);
    expect(ROADMAP.at(-1)!.versao).toBe("1.0.0");
  });

  it("versão lançada tem data e todas as entregas feitas; futura não tem data", () => {
    for (const v of ROADMAP) {
      if (v.status === "lancada") {
        expect(v.data, v.versao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(v.entregas.every((e) => e.feito), v.versao).toBe(true);
      } else {
        expect(v.data, v.versao).toBeUndefined();
      }
    }
  });

  it("ROADMAP.md está atualizado (rode `npm run roadmap`)", () => {
    expect(readFileSync("ROADMAP.md", "utf-8")).toBe(roadmapMarkdown(pacote.version));
  });
});
