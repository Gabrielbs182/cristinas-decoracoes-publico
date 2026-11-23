"use client";

import { useState } from "react";

import { lancarAjusteSaldo } from "@/app/(gestao)/ponto/fechamento/acoes";
import { Botao } from "@/components/ui/botao";
import { Campo, Selecao } from "@/components/ui/campos";

import { useAcao } from "./usar-acao";

const mascaraHora = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

/** Ajuste manual do banco de horas (gestora). Entra na semana em aberto, sempre com motivo. */
export function FormularioAjusteSaldo({ funcionariaId, nome, semanaRotulo }: { funcionariaId: string; nome: string; semanaRotulo: string }) {
  const [sinal, setSinal] = useState<"+" | "-">("+");
  const [horas, setHoras] = useState("");
  const [motivo, setMotivo] = useState("");
  const { enviando, executar } = useAcao();
  const valido = /^([01]\d|2[0-3]):[0-5]\d$/.test(horas) && horas !== "00:00" && motivo.trim().length >= 3;

  return (
    <form
      className="flex flex-col gap-2 border-b border-trilho px-4 py-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        executar(
          () => lancarAjusteSaldo({ funcionariaId, sinal, horas, motivo }),
          () => {
            setHoras("");
            setMotivo("");
          },
        );
      }}
    >
      <span className="text-xs text-tinta-3">
        Ajuste para {nome}, lançado na semana de {semanaRotulo} (em aberto).
      </span>
      <div className="flex gap-2">
        <Selecao value={sinal} onChange={(e) => setSinal(e.target.value as "+" | "-")} className="w-auto" aria-label="Somar ou descontar">
          <option value="+">Somar</option>
          <option value="-">Descontar</option>
        </Selecao>
        <Campo value={horas} onChange={(e) => setHoras(mascaraHora(e.target.value))} placeholder="HH:MM" inputMode="numeric" className="w-24 font-bold" aria-label="Horas" />
      </div>
      <Campo value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obrigatório)" aria-label="Motivo" />
      <Botao type="submit" variante="escuro" disabled={enviando || !valido}>
        Lançar ajuste
      </Botao>
    </form>
  );
}
