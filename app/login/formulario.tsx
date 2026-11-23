"use client";

import { useActionState, useRef, useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";

import { entrar, type EstadoLogin, pedirLinkPorEmail } from "./acoes";

export function FormularioLogin({ volta }: { volta?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});
  const [ajuda, setAjuda] = useState(false);
  // Login digitado na hora de pedir ajuda: com "@" dá para mandar o link por e-mail.
  const [email, setEmail] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [pedindo, pedir] = useTransition();
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <form ref={formulario} action={acao} className="flex w-full max-w-[380px] flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[32px] font-normal">Entrar</h1>
        <span className="text-sm text-tinta-3">Sistema de gestão da Cristina&apos;s Decorações</span>
      </div>
      {volta ? <input type="hidden" name="volta" value={volta} /> : null}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">E-mail ou usuário</span>
        <Campo name="login" defaultValue={estado.login} autoComplete="username" autoCapitalize="none" required className="h-12 text-[15px]" />
      </label>
      {/* O botão fica fora do <label>: dentro dele, o rótulo "Senha" passaria a nomear o botão, não o campo. */}
      <div className="flex flex-col gap-1.5">
        <span className="flex justify-between text-sm font-bold">
          <label htmlFor="senha">Senha</label>
          <button
            type="button"
            onClick={() => {
              const digitado = String(new FormData(formulario.current!).get("login") ?? "").trim();
              setEmail(digitado.includes("@") ? digitado : "");
              setResposta(null);
              setAjuda(true);
            }}
            className="cursor-pointer text-[13px] font-bold text-terracota"
          >
            Esqueci minha senha
          </button>
        </span>
        <Campo id="senha" name="senha" type="password" autoComplete="current-password" required className="h-12 text-[15px]" />
      </div>
      {estado.erro ? (
        <div role="alert" className="rounded-lg bg-perigo-fundo px-3 py-2.5 text-sm font-semibold text-perigo">
          {estado.erro}
        </div>
      ) : null}
      {ajuda ? (
        <div className="flex flex-col gap-2 rounded-lg bg-suave px-3 py-2.5 text-[13px] text-pretty text-tinta-2">
          {email ? (
            <>
              <span>Vamos mandar para {email} um link para criar uma senha nova.</span>
              {resposta ? (
                <b role="status">{resposta}</b>
              ) : (
                <Botao type="button" variante="secundario" disabled={pedindo} onClick={() => pedir(async () => setResposta((await pedirLinkPorEmail(email)).mensagem))}>
                  {pedindo ? "Enviando…" : "Mandar o link por e-mail"}
                </Botao>
              )}
            </>
          ) : (
            <span>Para criar uma senha nova, fale com a Cristina: ela gera um link de redefinição e manda pelo WhatsApp. Se você entra com e-mail, digite-o acima e toque de novo em “Esqueci minha senha”.</span>
          )}
        </div>
      ) : null}
      <Botao type="submit" tamanho="g" disabled={enviando} className="font-extrabold">
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
      <div className="rounded-lg bg-suave p-3 text-[13px] text-pretty text-tinta-3">
        Não tem e-mail? Use o usuário que a Cristina criou para você (ex.: <b>ana.s</b>).
      </div>
    </form>
  );
}
