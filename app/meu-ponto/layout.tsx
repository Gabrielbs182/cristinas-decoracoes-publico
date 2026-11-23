import Link from "next/link";

import { NavPortal } from "@/components/portal/nav-portal";
import { exigirPapel } from "@/lib/auth";
import { pendenciasAbertasDaFuncionaria } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { VERSAO } from "@/lib/versao";

import { sair } from "../login/acoes";

export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const sessao = await exigirPapel("funcionaria");
  const supabase = await criarClienteServidor();
  const pendencias = (await pendenciasAbertasDaFuncionaria(supabase, sessao.funcionariaId!)).filter((p) => !p.pedidoEnviado).length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-fundo">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-borda bg-superficie px-4 py-3">
        <Link href="/meu-ponto/perfil" className="flex min-w-0 flex-1 items-center gap-3 text-tinta no-underline" aria-label={`Meu perfil: ${sessao.nome}`}>
          <div className="grid size-11 flex-none place-items-center rounded-full bg-terracota-claro text-base font-extrabold text-terracota">
            {sessao.nome.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-xs font-semibold text-tinta-3">Cristina&apos;s Decorações</span>
            <span className="truncate text-[15px] font-bold">{sessao.nome}</span>
          </div>
        </Link>
        <form action={sair}>
          <button type="submit" className="h-11 cursor-pointer rounded-[10px] border border-borda-campo bg-superficie px-3 text-[13px] font-bold">
            Sair
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col gap-3.5 px-4 pt-4 pb-6">
        {children}
        <footer className="pt-2 text-center text-xs text-tinta-3">versão {VERSAO}</footer>
      </main>
      <NavPortal pendencias={pendencias} />
    </div>
  );
}
