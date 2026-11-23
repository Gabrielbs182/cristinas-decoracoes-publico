"use client";

import { AlertCircle, CalendarClock, FileText, MessageSquare, PiggyBank } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/meu-ponto", rotulo: "Ponto", Icone: CalendarClock },
  { href: "/meu-ponto/banco", rotulo: "Banco", Icone: PiggyBank },
  { href: "/meu-ponto/pendencias", rotulo: "Pendências", Icone: AlertCircle, tambem: ["/meu-ponto/corrigir"] },
  { href: "/meu-ponto/solicitacoes", rotulo: "Pedidos", Icone: MessageSquare },
  { href: "/meu-ponto/espelhos", rotulo: "Espelhos", Icone: FileText },
];

export function NavPortal({ pendencias }: { pendencias: number }) {
  const caminho = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-5 border-t border-borda bg-superficie px-1 pt-1 pb-[max(10px,env(safe-area-inset-bottom))]" aria-label="Portal">
      {ABAS.map(({ href, rotulo, Icone, tambem }) => {
        const ativo = caminho === href || (tambem ?? []).some((t) => caminho.startsWith(t));
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg", ativo ? "text-terracota" : "text-neutro")}
          >
            <span className={cn("absolute top-0 h-1 w-7 rounded-sm", ativo ? "bg-terracota" : "bg-transparent")} />
            <Icone className="size-5" strokeWidth={ativo ? 2.4 : 2} />
            <span className="text-xs font-extrabold">{rotulo}</span>
            {rotulo === "Pendências" && pendencias > 0 ? (
              <span
                className="absolute top-1 right-3 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-perigo px-1 text-[11px] font-extrabold text-white"
                aria-label={`${pendencias} pendência(s)`}
              >
                {pendencias}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
