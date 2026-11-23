"use client";

/** Diálogo central (confirmações). Radix: foco preso, Esc fecha, título e descrição acessíveis. */
import { Dialog } from "radix-ui";
import type * as React from "react";

export function Dialogo({
  aberto,
  aoMudar,
  titulo,
  descricao,
  children,
  rodape,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  descricao?: React.ReactNode;
  children?: React.ReactNode;
  rodape: React.ReactNode;
}) {
  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-tinta/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[460px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-[14px] bg-superficie p-[22px] shadow-[0_20px_50px_rgba(0,0,0,.25)] focus:outline-none">
          <Dialog.Title className="font-display text-[22px] font-medium">{titulo}</Dialog.Title>
          {descricao ? <Dialog.Description className="text-sm text-pretty text-tinta-2">{descricao}</Dialog.Description> : <Dialog.Description className="sr-only">{titulo}</Dialog.Description>}
          {children}
          <div className="flex flex-wrap justify-end gap-2.5">{rodape}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
