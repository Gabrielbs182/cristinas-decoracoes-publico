/**
 * Endereço e chave pública do Supabase, lidos quando o servidor sobe. As privadas ficam em lib/supabase/admin.ts.
 * Leitura por nome em variável (`env[nome]`), nunca o acesso direto às NEXT_PUBLIC_*: o Next embutiria o valor do build,
 * e a imagem de produção (montada pela CI, sem segredo nenhum) precisa servir para qualquer ambiente. Só o servidor
 * usa o Supabase, então nada disso vai para o navegador.
 */
const env = process.env;

function obrigatoria(nome: string): string {
  const valor = env[nome];
  // Durante o build não há ambiente (a CI monta a imagem sem chave); a falta só é erro com o servidor no ar.
  if (!valor && env.NEXT_PHASE !== "phase-production-build") throw new Error(`Variável de ambiente ausente: ${nome}. Veja .env.example.`);
  return valor ?? "";
}

export const supabaseUrl = obrigatoria("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseChavePublica = obrigatoria("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

/**
 * Cookie da sessão. O padrão da @supabase/ssr é legível pelo JavaScript da página e dura 400 dias; aqui só o
 * servidor usa o Supabase, então ele fica HttpOnly (um XSS não leva a sessão) e cai depois de 30 dias sem uso
 * (cada acesso renova). Secure só em produção: em dev o app roda em http e o cookie não voltaria.
 */
const VALIDADE_SESSAO = 30 * 24 * 60 * 60;
export const cookieOptions = {
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: VALIDADE_SESSAO,
};

/** A @supabase/ssr grava a sessão sempre com 400 dias (ignora o maxAge acima): quem grava o cookie aplica o nosso. */
export function comValidade<T extends { maxAge?: number }>(opcoes: T): T {
  return opcoes.maxAge === 0 ? opcoes : { ...opcoes, maxAge: VALIDADE_SESSAO };
}
