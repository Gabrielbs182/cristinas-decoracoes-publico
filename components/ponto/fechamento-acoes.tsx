"use client";

import { useState } from "react";

import { fecharSemana, gerarEspelhosQueFaltam, reabrirSemana } from "@/app/(gestao)/ponto/fechamento/acoes";
import { Botao } from "@/components/ui/botao";
import { AreaTexto } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";

import { useAcao } from "./usar-acao";

export function BotaoFecharSemana({ segunda, rotulo, funcionarias, impedimentos }: { segunda: string; rotulo: string; funcionarias: number; impedimentos: string[] }) {
  const [aberto, setAberto] = useState(false);
  const { enviando, executar } = useAcao();
  const bloqueado = impedimentos.length > 0;
  return (
    <>
      <Botao tamanho="g" disabled={bloqueado} onClick={() => setAberto(true)}>
        Fechar semana
      </Botao>
      {bloqueado ? (
        <ul className="flex flex-col gap-1 text-[13px] font-semibold text-perigo">
          {impedimentos.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo={`Fechar a semana de ${rotulo}?`}
        descricao={`A semana fica travada para edição e são gerados ${funcionarias} espelho(s) de ponto em PDF. Os saldos seguem para a semana seguinte. Só a gestora pode reabrir, e com motivo.`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao onClick={() => executar(() => fecharSemana({ segunda }), () => setAberto(false))} disabled={enviando}>
              {enviando ? "Fechando…" : "Fechar semana"}
            </Botao>
          </>
        }
      />
    </>
  );
}

export function BotaoReabrirSemana({ segunda, rotulo }: { segunda: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const { enviando, executar } = useAcao();
  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        Reabrir semana
      </Botao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo={`Reabrir a semana de ${rotulo}?`}
        descricao="A semana volta a aceitar alterações e o fechamento é desfeito; ao fechar de novo, os espelhos são gerados outra vez. Fica registrado quem reabriu e por quê."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao
              disabled={enviando || motivo.trim().length < 3}
              onClick={() =>
                executar(
                  () => reabrirSemana({ segunda, motivo }),
                  () => {
                    setAberto(false);
                    setMotivo("");
                  },
                )
              }
            >
              Reabrir
            </Botao>
          </>
        }
      >
        <AreaTexto autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo da reabertura (obrigatório)" />
      </Dialogo>
    </>
  );
}

export function BotaoGerarEspelhos({ segunda }: { segunda: string }) {
  const { enviando, executar } = useAcao();
  return (
    <Botao variante="secundario" disabled={enviando} onClick={() => executar(() => gerarEspelhosQueFaltam({ segunda }))}>
      {enviando ? "Gerando…" : "Gerar espelhos que faltam"}
    </Botao>
  );
}
