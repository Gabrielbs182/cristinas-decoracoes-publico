import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Os testes de RLS falam com o Supabase local; os de unidade não precisam de nada externo.
    testTimeout: 20_000,
    // Os arquivos de banco montam cenários com os mesmos IDs de catraca: um arquivo por vez.
    fileParallelism: false,
  },
});
