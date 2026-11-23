/**
 * A imagem de produção é uma só para qualquer ambiente (montada pela CI, sem chave dentro). Regressão (25/10/2026):
 * o código lia `process.env.NEXT_PUBLIC_…`, que o Next embute no build — a imagem ficava presa ao Supabase do build.
 * Endereço e chave do Supabase só por lib/config.ts, que lê quando o servidor sobe.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const p = path.join(pasta, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("configuração lida quando o servidor sobe", () => {
  it("nenhum código do app usa process.env.NEXT_PUBLIC_ (seria embutido no build)", () => {
    const suspeitos = [...arquivos("app"), ...arquivos("lib"), ...arquivos("components"), "proxy.ts", "instrumentation.ts"].filter((f) =>
      /process\.env\.NEXT_PUBLIC_|process\.env\[["']NEXT_PUBLIC_/.test(readFileSync(f, "utf-8")),
    );
    expect(suspeitos).toEqual([]);
  });
});
