"use client";

import { useState } from "react";

import { salvarPadroesOrcamento } from "@/app/(gestao)/configuracoes/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { Rotulado } from "@/components/ui/rotulado";

export interface Padroes {
  proximoNumero: string;
  proximoRecibo: string;
  validadeDias: string;
  prazoEntrega: string;
  condicoes: string;
}

export function PadroesOrcamento({ atuais, ultimo, ultimoRecibo }: { atuais: Padroes; ultimo: number | null; ultimoRecibo: number | null }) {
  const { enviando, executar } = useAcao();
  const [p, setP] = useState(atuais);
  const mudou = (Object.keys(p) as (keyof Padroes)[]).some((k) => p[k] !== atuais[k]);
  const campo = (k: keyof Padroes) => ({ value: p[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setP((x) => ({ ...x, [k]: e.target.value })) });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => salvarPadroesOrcamento(p));
      }}
    >
      <Rotulado titulo="Próximo orçamento" dica={ultimo ? `Último usado: ${String(ultimo).padStart(4, "0")}. Só dá para avançar.` : "Para continuar a numeração que a loja já usa."}>
        <Campo {...campo("proximoNumero")} inputMode="numeric" className="w-32 font-bold tabular-nums" />
      </Rotulado>
      <Rotulado titulo="Próximo recibo" dica={ultimoRecibo ? `Último usado: ${String(ultimoRecibo).padStart(4, "0")}. Só dá para avançar.` : "Para continuar a numeração do talão."}>
        <Campo {...campo("proximoRecibo")} inputMode="numeric" className="w-32 font-bold tabular-nums" />
      </Rotulado>
      <Rotulado titulo="Validade padrão (dias)" dica="Conta a partir do envio.">
        <Campo {...campo("validadeDias")} inputMode="numeric" className="w-24" />
      </Rotulado>
      <Rotulado titulo="Prazo de entrega padrão" className="sm:col-span-2">
        <Campo {...campo("prazoEntrega")} maxLength={120} />
      </Rotulado>
      <Rotulado titulo="Condições de pagamento padrão" className="sm:col-span-2">
        <Campo {...campo("condicoes")} maxLength={200} />
      </Rotulado>
      <Botao type="submit" disabled={enviando || !mudou} className="self-start">
        Salvar padrões
      </Botao>
    </form>
  );
}
