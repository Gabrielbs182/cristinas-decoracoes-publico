/**
 * Lança o vitest com o drive em maiúscula (npm test). No Windows, se o terminal entrega a pasta atual como
 * "c:\…", o vitest se carrega por dois caminhos (c:/… e C:/…) e TODOS os arquivos falham com
 * "Vitest failed to find the runner" — e a rodada seguinte, de outro terminal, passa. Normalizar a pasta e o
 * caminho do vitest antes de abri-lo resolve (o vitest.config não alcança: o vitest já está carregado).
 *
 *   npm test                 # todos
 *   npm test -- tests/rls    # só os de banco
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const raiz = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const vitest = path.join(raiz, "node_modules", "vitest", "vitest.mjs");
const r = spawnSync(process.execPath, [vitest, ...process.argv.slice(2)], { cwd: raiz, stdio: "inherit" });
process.exit(r.status ?? 1);
