/** Regera o ROADMAP.md a partir de lib/roadmap.ts.  npm run roadmap */
import { writeFileSync } from "node:fs";

import pacote from "../package.json";
import { roadmapMarkdown } from "../lib/roadmap";

writeFileSync("ROADMAP.md", roadmapMarkdown(pacote.version), "utf-8");
console.log(`ROADMAP.md gerado (versão ${pacote.version}).`);
