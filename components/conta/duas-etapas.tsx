"use client";

import { ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { confirmarDuasEtapas, desligarDuasEtapas, iniciarDuasEtapas } from "@/app/definir-senha/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";

/** Verificação em duas etapas (opcional): ligar com o app autenticador, ou desligar. */
export function DuasEtapas({ ligada }: { ligada: boolean }) {
  const [inscricao, setInscricao] = useState<{ fatorId: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [iniciando, iniciar] = useTransition();
  const { enviando, executar } = useAcao();

  if (ligada) {
    return (
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-sucesso">
          <ShieldCheck className="size-4" /> Ligada: ao entrar, além da senha, o sistema pede o código do app.
        </span>
        <Botao type="button" variante="secundario" disabled={enviando} className="self-start" onClick={() => executar(() => desligarDuasEtapas())}>
          Desligar verificação em duas etapas
        </Botao>
      </div>
    );
  }

  if (!inscricao) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm text-pretty text-tinta-3">
          Opcional. Além da senha, o login pede um código de 6 números de um app no celular (Google Authenticator, Microsoft Authenticator…). Protege mesmo se a
          senha vazar.
        </span>
        <Botao
          type="button"
          variante="secundario"
          disabled={iniciando}
          className="self-start"
          onClick={() =>
            iniciar(async () => {
              const r = await iniciarDuasEtapas();
              if (r.ok) setInscricao(r);
              else toast.error(r.erro);
            })
          }
        >
          <ShieldCheck /> Ligar verificação em duas etapas
        </Botao>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => confirmarDuasEtapas({ fatorId: inscricao.fatorId, codigo }));
      }}
    >
      <span className="text-sm text-pretty">1. No app autenticador, adicione uma conta lendo este QR code:</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR code em SVG gerado na hora (data:), não passa pelo otimizador */}
      <img src={inscricao.qr} alt="QR code para o app autenticador" className="size-44 self-start rounded-lg border border-borda bg-white p-2" />
      <span className="text-[13px] text-pretty text-tinta-3">
        Não dá para ler? Digite no app este código:{" "}
        <code className="font-mono text-tinta select-all" data-segredo>
          {inscricao.segredo}
        </code>
      </span>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm">2. Digite o código de 6 números que o app mostra</span>
        <Campo value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="max-w-40 text-center tracking-[0.3em]" />
      </label>
      <Botao type="submit" disabled={enviando || codigo.replace(/\D/g, "").length !== 6} className="self-start">
        Confirmar e ligar
      </Botao>
    </form>
  );
}
