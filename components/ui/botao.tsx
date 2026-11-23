import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const estilos = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        primario: "bg-terracota text-white hover:bg-terracota-escuro",
        secundario: "border border-borda-campo bg-superficie text-tinta font-semibold hover:bg-[#f6f1ea]",
        escuro: "bg-tinta text-white hover:bg-black",
        perigo: "border border-[#e7bfc5] bg-superficie text-perigo font-semibold hover:bg-perigo-fundo",
        sucesso: "bg-sucesso text-white hover:bg-[#245a39]",
        suave: "bg-terracota-claro text-terracota-escuro hover:bg-[#efd6c6]",
        link: "h-auto px-0 text-terracota underline-offset-4 hover:underline hover:text-terracota-escuro",
      },
      tamanho: {
        p: "h-8 px-3 text-[13px]",
        m: "h-10 px-4 text-sm",
        g: "h-12 px-5 text-[15px]",
        icone: "size-9",
      },
    },
    defaultVariants: { variante: "primario", tamanho: "m" },
  },
);

export interface BotaoProps extends React.ComponentProps<"button">, VariantProps<typeof estilos> {
  asChild?: boolean;
}

export function Botao({ className, variante, tamanho, asChild, ...props }: BotaoProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(estilos({ variante, tamanho }), className)} {...props} />;
}

export { estilos as estilosBotao };
