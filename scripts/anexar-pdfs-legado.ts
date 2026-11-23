/**
 * Anexa os espelhos em PDF do sistema antigo às semanas importadas do histórico.
 *
 *   npx tsx --env-file=.env.development.local scripts/anexar-pdfs-legado.ts
 *
 * Lê PONTOS_DIR/data/output/<nome de exibição>/<nome> - YYYYMMDD - ....pdf e envia para o bucket
 * `espelhos` em <funcionaria_id>/<segunda>.pdf (mesmo caminho dos espelhos gerados pelo sistema).
 * Idempotente: reenviar sobrescreve. Só anexa a semanas fechadas que têm resultado da funcionária.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { caminhoEspelho } from "../lib/ponto/fechamento";
import type { Database } from "../lib/supabase/database.types";

const PONTOS = process.env.PONTOS_DIR ?? path.resolve("..", "Pontos");
const SAIDA = path.join(PONTOS, "data", "output");
const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

async function main() {
  if (!existsSync(SAIDA)) throw new Error(`Pasta não encontrada: ${SAIDA}`);
  const [{ data: funcionarias }, { data: resultados }] = await Promise.all([
    admin.from("funcionarias").select("id, nome_exibicao"),
    admin.from("semana_resultados").select("segunda, funcionaria_id"),
  ]);
  const temResultado = new Set((resultados ?? []).map((r) => `${r.funcionaria_id}|${r.segunda}`));

  let anexados = 0;
  const ignorados: string[] = [];
  for (const f of funcionarias ?? []) {
    const pasta = path.join(SAIDA, f.nome_exibicao);
    if (!existsSync(pasta)) continue;
    for (const arquivo of readdirSync(pasta).filter((a) => a.toLowerCase().endsWith(".pdf"))) {
      const m = / - (\d{4})(\d{2})(\d{2}) - /.exec(arquivo);
      if (!m) {
        ignorados.push(`${arquivo} (nome fora do padrão)`);
        continue;
      }
      const segunda = `${m[1]}-${m[2]}-${m[3]}`;
      if (!temResultado.has(`${f.id}|${segunda}`)) {
        ignorados.push(`${arquivo} (semana sem fechamento no sistema)`);
        continue;
      }
      const destino = caminhoEspelho(f.id, segunda);
      const { error } = await admin.storage
        .from("espelhos")
        .upload(destino, readFileSync(path.join(pasta, arquivo)), { contentType: "application/pdf", upsert: true });
      if (error) throw new Error(`${arquivo}: ${error.message}`);
      const { error: eRes } = await admin.from("semana_resultados").update({ espelho_path: destino }).eq("segunda", segunda).eq("funcionaria_id", f.id);
      if (eRes) throw new Error(`${arquivo}: ${eRes.message}`);
      anexados++;
    }
  }
  console.log(`${anexados} espelho(s) do sistema antigo anexado(s).`);
  for (const i of ignorados) console.log(`  ignorado: ${i}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
