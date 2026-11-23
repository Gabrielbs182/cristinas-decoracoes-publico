"use client";

import { useActionState } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";

import { type EstadoCodigo, sair, verificarCodigo } from "../acoes";

export function FormularioCodigo({ volta }: { volta?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCodigo, FormData>(verificarCodigo, {});
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-4">
      <form action={acao} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[32px] font-normal">Código de verificação</h1>
          <span className="text-sm text-pretty text-tinta-3">Abra o app autenticador no celular e digite o código de 6 números da Cristina&apos;s Decorações.</span>
        </div>
        {volta ? <input type="hidden" name="volta" value={volta} /> : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Código</span>
          <Campo name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus required className="h-12 text-center text-[22px] tracking-[0.3em]" />
        </label>
        {estado.erro ? (
          <div role="alert" className="rounded-lg bg-perigo-fundo px-3 py-2.5 text-sm font-semibold text-perigo">
            {estado.erro}
          </div>
        ) : null}
        <Botao type="submit" tamanho="g" disabled={enviando} className="font-extrabold">
          {enviando ? "Conferindo…" : "Entrar"}
        </Botao>
      </form>
      <form action={sair}>
        <Botao type="submit" variante="secundario" className="w-full">
          Entrar com outro usuário
        </Botao>
      </form>
      <p className="text-[13px] text-pretty text-tinta-3">Perdeu o celular ou o app? Fale com a Cristina: ela desliga a verificação do seu acesso.</p>
    </div>
  );
}
