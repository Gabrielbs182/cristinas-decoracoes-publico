"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { definirSenha } from "@/app/definir-senha/acoes";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";

export function FormSenha({ tokenHash, titulo, subtitulo }: { tokenHash?: string; titulo: string; subtitulo: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [atual, setAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = useId();
  const regraOk = senha.length >= 8 && /[a-zA-Z]/.test(senha) && /\d/.test(senha);

  return (
    <form
      className="flex w-full max-w-[380px] flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await definirSenha({ senha, confirmacao, tokenHash, senhaAtual: tokenHash ? undefined : atual });
          if (!r.ok) {
            setErro(r.erro);
            return;
          }
          toast.success(r.mensagem);
          router.replace(r.destino);
          router.refresh();
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[32px] font-normal">{titulo}</h1>
        <span className="text-sm text-pretty text-tinta-3">{subtitulo}</span>
      </div>
      {/* Sem link (já está dentro): confirma quem é antes de trocar — um celular desbloqueado não basta. */}
      {tokenHash ? null : (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Senha atual</span>
          <Campo
            type={ver ? "text" : "password"}
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            autoComplete="current-password"
            required
            className="h-12 text-[15px]"
          />
        </label>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={`${id}-senha`} className="text-sm font-bold">
            Senha nova
          </label>
          <button type="button" onClick={() => setVer((v) => !v)} className="flex cursor-pointer items-center gap-1 text-[13px] font-bold text-terracota" aria-pressed={ver}>
            {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {ver ? "Esconder senhas" : "Mostrar senhas"}
          </button>
        </div>
        <Campo
          id={`${id}-senha`}
          type={ver ? "text" : "password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
          required
          aria-describedby={`${id}-regra`}
          className="h-12 text-[15px]"
        />
        <span id={`${id}-regra`} className={regraOk ? "text-xs font-semibold text-sucesso" : "text-xs text-tinta-3"}>
          Pelo menos 8 caracteres, com letras e números.
        </span>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Repita a senha</span>
        <Campo
          type={ver ? "text" : "password"}
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          autoComplete="new-password"
          required
          className="h-12 text-[15px]"
        />
      </label>
      {erro ? (
        <div role="alert" className="rounded-lg bg-perigo-fundo px-3 py-2.5 text-sm font-semibold text-pretty text-perigo">
          {erro}
        </div>
      ) : null}
      <Botao type="submit" tamanho="g" disabled={enviando || !regraOk || senha !== confirmacao || (!tokenHash && !atual)} className="font-extrabold">
        {enviando ? "Salvando…" : "Salvar senha"}
      </Botao>
    </form>
  );
}
