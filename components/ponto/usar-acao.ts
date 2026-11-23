"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import type { RespostaAcao } from "@/app/(gestao)/ponto/acoes";

/** Roda uma server action com estado de "enviando" e avisa o resultado. */
export function useAcao() {
  const [enviando, iniciar] = useTransition();
  const executar = (acao: () => Promise<RespostaAcao>, depois?: () => void) =>
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        toast.success(r.mensagem);
        depois?.();
      } else {
        toast.error(r.erro);
      }
    });
  return { enviando, executar };
}
