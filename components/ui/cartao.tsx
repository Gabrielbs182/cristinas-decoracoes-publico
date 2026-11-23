import type * as React from "react";

import { cn } from "@/lib/utils";

export function Cartao({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-borda bg-superficie", className)} {...props} />;
}

export function CabecalhoCartao({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center justify-between gap-3 border-b border-trilho px-4 py-3.5", className)} {...props} />;
}

/** Rótulo pequeno em caixa alta (cabeçalho de tabela, título de bloco). */
export function Sobretitulo({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-xs font-bold tracking-[.05em] text-tinta-3 uppercase", className)} {...props} />;
}

/** Título de página: contexto pequeno em cima, título em Jost. */
export function TituloPagina({ contexto, titulo, children }: { contexto?: React.ReactNode; titulo: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {contexto ? <div className="text-[13px] font-semibold text-tinta-3">{contexto}</div> : null}
        <h1 className="font-display text-[30px] leading-tight font-medium">{titulo}</h1>
      </div>
      {children ? <div className="flex flex-wrap items-center justify-end gap-2.5">{children}</div> : null}
    </div>
  );
}

export function EstadoVazio({ icone, titulo, children, acao }: { icone: React.ReactNode; titulo: string; children?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-tracejado bg-superficie px-6 py-14 text-center">
      <div className="grid size-13 place-items-center rounded-full bg-terracota-claro text-terracota [&_svg]:size-6">{icone}</div>
      <div className="font-display text-[22px] font-medium">{titulo}</div>
      {children ? <div className="max-w-md text-sm text-pretty text-tinta-3">{children}</div> : null}
      {acao ? <div className="mt-1.5">{acao}</div> : null}
    </div>
  );
}
