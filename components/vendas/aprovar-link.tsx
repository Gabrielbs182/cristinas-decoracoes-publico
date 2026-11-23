"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { aprovarPeloLink } from "@/app/o/[token]/acoes";
import { Botao } from "@/components/ui/botao";
import { Dialogo } from "@/components/ui/dialogo";

export function AprovarPeloLink({ token, numero, total }: { token: string; numero: string; total: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [enviando, iniciar] = useTransition();
  return (
    <>
      <Botao variante="sucesso" tamanho="g" className="w-full font-extrabold" onClick={() => setAberto(true)}>
        <Check /> Aprovar orçamento
      </Botao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo={`Aprovar o orçamento nº ${numero}?`}
        descricao={`Total de ${total}. A loja recebe a aprovação na hora e entra em contato para combinar o sinal e a instalação.`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Agora não
            </Botao>
            <Botao
              variante="sucesso"
              disabled={enviando}
              onClick={() =>
                iniciar(async () => {
                  const r = await aprovarPeloLink({ token });
                  if (!r.ok) {
                    toast.error(r.erro);
                    return;
                  }
                  toast.success(r.mensagem);
                  setAberto(false);
                  router.refresh();
                })
              }
            >
              Sim, aprovar
            </Botao>
          </>
        }
      />
    </>
  );
}
