"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { excluirCliente } from "@/app/(gestao)/clientes/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Dialogo } from "@/components/ui/dialogo";

export function ExcluirCliente({ id, nome }: { id: string; nome: string }) {
  const { enviando, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao variante="perigo" onClick={() => setAberto(true)}>
        <Trash2 /> Excluir
      </Botao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo={`Excluir ${nome}?`}
        descricao="Some da lista de clientes. Cliente que já tem orçamento ou recibo não pode ser excluído."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" disabled={enviando} onClick={() => executar(() => excluirCliente({ id }))}>
              Excluir
            </Botao>
          </>
        }
      />
    </>
  );
}
