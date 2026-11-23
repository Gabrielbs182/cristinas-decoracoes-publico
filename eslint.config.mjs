import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // deploy/supabase/docker: o Supabase oficial que o preparar.sh baixa (não é código nosso).
  { ignores: [".next/**", "node_modules/**", "docs/**", "supabase/**", "deploy/supabase/docker/**", ".ambiente-teste/**", "lib/supabase/database.types.ts"] },
];

export default config;
