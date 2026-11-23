"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { cancelarRecibo } from "@/app/(gestao)/recibos/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { AreaTexto } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";

export function CancelarRecibo({ id, numero, resumo, tamanho = "m" }: { id: string; numero: string; resumo: string; tamanho?: "p" | "m" }) {
  const { enviando, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  return (
    <>
      <Botao variante="perigo" tamanho={tamanho} onClick={() => setAberto(true)}>
        <X /> Cancelar
      </Botao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo={`Cancelar o recibo nº ${numero}?`}
        descricao={`${resumo}. O recibo continua na lista, marcado como cancelado, e o número ${numero} não será reaproveitado. Se for de orçamento, o valor volta para o saldo.`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Voltar
            </Botao>
            <Botao variante="perigo" disabled={enviando || motivo.trim().length < 3} onClick={() => executar(() => cancelarRecibo({ id, motivo }), () => setAberto(false))}>
              Cancelar recibo
            </Botao>
          </>
        }
      >
        <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do cancelamento (obrigatório)" aria-label="Motivo do cancelamento" maxLength={500} />
      </Dialogo>
    </>
  );
}
