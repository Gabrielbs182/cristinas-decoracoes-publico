"use client";

/**
 * Campo com rótulo e dica ligados do jeito acessível: o rótulo vira o nome do campo (htmlFor) e a dica,
 * a descrição (aria-describedby). Dica dentro do <label> entraria no nome ("Nome Ex.: …").
 */
import { cloneElement, useId } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

import { Campo } from "./campos";

type Controle = React.ReactElement<{ id?: string; "aria-describedby"?: string }>;

export function Rotulado({ titulo, dica, className, children }: { titulo: React.ReactNode; dica?: React.ReactNode; className?: string; children: Controle }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-bold">
        {titulo}
      </label>
      {cloneElement(children, { id, "aria-describedby": dica ? `${id}-dica` : undefined })}
      {dica ? (
        <span id={`${id}-dica`} className="text-xs text-pretty text-tinta-3">
          {dica}
        </span>
      ) : null}
    </div>
  );
}

/** Valor em reais com o "R$" fixo na frente (decorativo: fica fora do nome do campo). */
export function CampoDinheiro({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-tinta-3">
        R$
      </span>
      <Campo inputMode="decimal" {...props} className="pl-9 font-bold tabular-nums" />
    </div>
  );
}
