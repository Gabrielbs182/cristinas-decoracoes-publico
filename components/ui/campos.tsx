import type * as React from "react";

import { cn } from "@/lib/utils";

const base =
  "w-full rounded-lg border border-borda-campo bg-superficie px-3 text-sm text-tinta placeholder:text-tinta-4 focus-visible:border-terracota disabled:opacity-60";

export function Campo({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(base, "h-10", className)} {...props} />;
}

export function AreaTexto({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(base, "min-h-20 py-2.5 resize-y", className)} {...props} />;
}

export function Selecao({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(base, "h-10 pr-8", className)} {...props} />;
}
