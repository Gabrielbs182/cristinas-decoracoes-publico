/** Selo de situação: cor + ícone + texto (nunca só cor). */
import { AlertTriangle, Ban, Check, Circle, Clock, Info, Pencil, Plus, Star, X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export type TomSelo = "ok" | "perigo" | "atencao" | "ajuste" | "info" | "neutro" | "marca";

const TOM: Record<TomSelo, { fg: string; bg: string }> = {
  ok: { fg: "bg-sucesso text-sucesso", bg: "bg-sucesso-fundo" },
  perigo: { fg: "bg-perigo text-perigo", bg: "bg-perigo-fundo" },
  atencao: { fg: "bg-atencao text-atencao", bg: "bg-atencao-fundo" },
  ajuste: { fg: "bg-ajuste text-ajuste", bg: "bg-ajuste-fundo" },
  info: { fg: "bg-info text-info", bg: "bg-info-fundo" },
  neutro: { fg: "bg-neutro text-neutro", bg: "bg-neutro-fundo" },
  marca: { fg: "bg-terracota text-terracota-escuro", bg: "bg-terracota-claro" },
};

export const ICONES = { check: Check, alerta: AlertTriangle, lapis: Pencil, x: X, mais: Plus, estrela: Star, circulo: Circle, relogio: Clock, info: Info, bloqueio: Ban } as const;

export function Selo({
  tom,
  icone,
  children,
  className,
  tamanho = "m",
}: {
  tom: TomSelo;
  icone: keyof typeof ICONES;
  children: React.ReactNode;
  className?: string;
  tamanho?: "m" | "g";
}) {
  const t = TOM[tom];
  const Icone = ICONES[icone];
  const [bolinha, texto] = t.fg.split(" ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 self-start rounded-full font-bold whitespace-nowrap",
        tamanho === "m" ? "h-[22px] pl-1 pr-2 text-xs" : "h-[26px] pl-1 pr-2.5 text-[13px]",
        t.bg,
        texto,
        className,
      )}
    >
      <span className={cn("grid place-items-center rounded-full text-white", tamanho === "m" ? "size-[15px]" : "size-[18px]", bolinha)}>
        <Icone className={tamanho === "m" ? "size-2.5" : "size-3"} strokeWidth={3} aria-hidden />
      </span>
      {children}
    </span>
  );
}
