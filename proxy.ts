/**
 * proxy.ts — convenção do Next 16 (substitui middleware.ts). Renova a sessão do Supabase em toda
 * requisição e manda para o login quem não está autenticado. A autorização por papel NÃO mora aqui:
 * fica nos layouts (exigirPapel) e, por baixo de tudo, no RLS do banco.
 */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { comValidade, cookieOptions, supabaseChavePublica, supabaseUrl } from "@/lib/config";

// /o/: página do orçamento para a cliente (sem login; o token aleatório é a chave, e o banco só mostra orçamento enviado).
// /api/saude: o monitoramento da VPS pergunta se está tudo de pé (não devolve dado nenhum).
// /modelos/: o modelo do e-mail de senha nova, que o Auth do Supabase da VPS busca por http (sem dado nenhum).
const PUBLICAS = ["/login", "/auth/", "/o/", "/api/saude", "/modelos/"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseChavePublica, {
    cookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, comValidade(options)));
      },
    },
  });

  // getUser valida o token no servidor de Auth (não confia só no cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => caminho === p || caminho.startsWith(p));
  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = caminho === "/" ? "" : `?volta=${encodeURIComponent(caminho)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
