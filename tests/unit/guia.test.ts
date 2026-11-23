/** O guia rápido não pode mandar para tela que não existe (tela renomeada ou removida deixa o guia velho). */
import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GUIA_CONTADOR, GUIA_FUNCIONARIA, GUIA_GESTORA } from "@/lib/guia";

function telas(pasta = "app", partes: string[] = []): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((i) =>
    i.isDirectory() ? telas(path.join(pasta, i.name), /^\(.*\)$/.test(i.name) ? partes : [...partes, i.name]) : i.name === "page.tsx" ? [`/${partes.join("/")}`] : [],
  );
}

describe("guia rápido", () => {
  const existentes = new Set(telas());
  it.each([
    ["gestora", GUIA_GESTORA],
    ["contador", GUIA_CONTADOR],
    ["funcionária", GUIA_FUNCIONARIA],
  ])("os atalhos do guia da %s abrem telas que existem", (_, topicos) => {
    for (const t of topicos) if (t.onde) expect(existentes, `${t.titulo} → ${t.onde.href}`).toContain(t.onde.href);
  });
});
