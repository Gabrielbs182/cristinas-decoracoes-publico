import { ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";

import type { Topico } from "@/lib/guia";

/** Tópicos do guia rápido: título, passos numerados, dica e o atalho para a tela. */
export function TopicosDoGuia({ topicos }: { topicos: Topico[] }) {
  return (
    <div className="flex flex-col gap-3">
      {topicos.map((t) => (
        <section key={t.titulo} className="flex flex-col gap-3 rounded-[14px] border border-borda bg-superficie p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-normal">{t.titulo}</h2>
            {t.onde ? (
              <Link href={t.onde.href} className="flex items-center gap-1 text-sm font-bold text-terracota">
                Abrir {t.onde.rotulo} <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </div>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] text-pretty text-tinta-2">
            {t.passos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          {t.dica ? (
            <p className="flex items-start gap-2 rounded-lg bg-suave px-3 py-2.5 text-sm text-pretty text-tinta-2">
              <Lightbulb className="mt-0.5 size-4 flex-none text-terracota" /> {t.dica}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
