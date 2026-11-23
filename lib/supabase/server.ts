/** Cliente Supabase com a sessão do usuário (RSC, server actions). Todas as consultas passam pelo RLS. */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { comValidade, cookieOptions, supabaseChavePublica, supabaseUrl } from "@/lib/config";
import type { Database } from "@/lib/supabase/database.types";

export async function criarClienteServidor() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, supabaseChavePublica, {
    cookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, comValidade(options)));
        } catch {
          // Server Component não grava cookie; o proxy.ts renova a sessão.
        }
      },
    },
  });
}

export type ClienteSupabase = Awaited<ReturnType<typeof criarClienteServidor>>;
