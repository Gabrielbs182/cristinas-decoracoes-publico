"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { aprovarSolicitacao, recusarSolicitacao } from "@/app/(gestao)/ponto/solicitacoes/acoes";
import { Botao, estilosBotao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";

import { useAcao } from "./usar-acao";

/** Coluna de ações de um pedido aguardando resposta; a recusa abre o campo da resposta embaixo. */
export function AcoesSolicitacao({ id, linkDia, plano, bloqueio }: { id: number; linkDia: string; plano: string | null; bloqueio: string | null }) {
  const { enviando, executar } = useAcao();
  const [recusando, setRecusando] = useState(false);
  const [resposta, setResposta] = useState("");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2 sm:flex-col">
        <Botao variante="sucesso" disabled={enviando || !!bloqueio} onClick={() => executar(() => aprovarSolicitacao({ id }))}>
          <Check /> Aprovar
        </Botao>
        <Botao variante="perigo" disabled={enviando} onClick={() => setRecusando((r) => !r)} aria-expanded={recusando}>
          <X /> Recusar
        </Botao>
        <Link href={linkDia} className={estilosBotao({ variante: "secundario" })}>
          Ver o dia
        </Link>
      </div>
      <span className="text-xs text-pretty text-tinta-3 sm:max-w-44">{bloqueio ?? (plano ? `Ao aprovar: ${plano.toLowerCase()}, com o motivo dela.` : null)}</span>
      {recusando ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            executar(
              () => recusarSolicitacao({ id, resposta }),
              () => setRecusando(false),
            );
          }}
        >
          <Campo autoFocus value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Resposta para a funcionária (obrigatória)" />
          <Botao type="submit" variante="perigo" disabled={enviando || resposta.trim().length < 3}>
            Recusar e responder
          </Botao>
        </form>
      ) : null}
    </div>
  );
}
