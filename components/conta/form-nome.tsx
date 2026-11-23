"use client";

import { useState } from "react";

import { alterarMeuNome } from "@/app/definir-senha/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { Rotulado } from "@/components/ui/rotulado";

export function FormNome({ atual, dica, grande }: { atual: string; dica: string; grande?: boolean }) {
  const { enviando, executar } = useAcao();
  const [nome, setNome] = useState(atual);
  const valido = nome.trim().length >= 2 && nome.trim().length <= 40;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => alterarMeuNome({ nome }));
      }}
    >
      <Rotulado titulo="Como você quer aparecer" dica={dica}>
        <Campo value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoComplete="nickname" className={grande ? "h-12 text-base" : undefined} />
      </Rotulado>
      <Botao type="submit" tamanho={grande ? "g" : "m"} disabled={enviando || !valido || nome.trim() === atual} className="self-start">
        Salvar nome
      </Botao>
    </form>
  );
}
