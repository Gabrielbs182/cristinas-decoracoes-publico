"use client";

/** Painel que desliza da direita (detalhe do dia). Radix Dialog: foco preso, Esc fecha, acessível. */
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type * as React from "react";

export function PainelLateral({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  extra,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-tinta/35 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[600px] max-w-full flex-col overflow-y-auto bg-[#fbf9f5] shadow-[-12px_0_32px_rgba(43,36,33,.18)] focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-borda bg-superficie px-5 py-4">
            <div className="flex flex-1 flex-col gap-1.5">
              {subtitulo ? <Dialog.Description className="text-[13px] font-semibold text-tinta-3">{subtitulo}</Dialog.Description> : null}
              <div className="flex flex-wrap items-center gap-2.5">
                <Dialog.Title className="font-display text-2xl font-medium">{titulo}</Dialog.Title>
                {extra}
              </div>
            </div>
            <Dialog.Close className="grid size-10 cursor-pointer place-items-center rounded-lg border border-borda-campo bg-superficie" aria-label="Fechar">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-5 px-5 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
