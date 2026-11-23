"use client";

import Link from "next/link";
import { useState } from "react";

import { aceitarSugestao, justificarPendencia, lancarNoDia } from "@/app/(gestao)/ponto/acoes";
import { Botao, estilosBotao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { Selo } from "@/components/ui/selo";
import { type Pendencia, type TipoBatida } from "@/lib/ponto";
import { cn } from "@/lib/utils";

import { useAcao } from "./usar-acao";

/** Pendências em que falta UMA batida: dá para informar o horário direto. */
const FALTANTE: Partial<Record<Pendencia["codigo"], TipoBatida>> = {
  FALTA_VOLTA_ALMOCO: "V",
  FALTA_SAIDA_ALMOCO: "A",
  FALTA_SAIDA: "S",
};

const mascaraHora = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

export function SeloSeveridade({ p }: { p: Pendencia }) {
  return p.severidade === "bloqueia" ? (
    <Selo tom="perigo" icone="alerta">
      Bloqueia
    </Selo>
  ) : (
    <Selo tom="atencao" icone="alerta">
      Aviso
    </Selo>
  );
}

/** Linha de ações usada na fila de pendências. */
export function AcoesPendencia({ p, funcionariaId, data, linkDia }: { p: Pendencia; funcionariaId: string; data: string; linkDia: string }) {
  const { enviando, executar } = useAcao();
  const [justificando, setJustificando] = useState(false);
  const [texto, setTexto] = useState("");
  const [faltando, setFaltando] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {p.sugestao.acoes.length ? (
          <Botao tamanho="p" disabled={enviando} onClick={() => executar(() => aceitarSugestao({ funcionariaId, data, codigo: p.codigo }))}>
            {p.severidade === "aviso" ? "Confirmar" : "Aceitar sugestão"}
          </Botao>
        ) : null}
        <Link href={linkDia} className={estilosBotao({ variante: "secundario", tamanho: "p" })} scroll={false}>
          Ajustar no dia
        </Link>
        <Botao variante="secundario" tamanho="p" onClick={() => setJustificando((j) => !j)}>
          Justificar
        </Botao>
        {p.severidade === "bloqueia" ? (
          <Botao variante="perigo" tamanho="p" onClick={() => setFaltando((f) => !f)}>
            Marcar falta
          </Botao>
        ) : null}
      </div>
      {justificando || faltando ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (justificando)
              executar(() => justificarPendencia({ funcionariaId, data, codigo: p.codigo, justificativa: texto }), () => setJustificando(false));
            else
              executar(
                () => lancarNoDia({ funcionariaId, data, motivo: texto, lancamento: { tipo: "ocorrencia", ocorrencia: "falta" } }),
                () => setFaltando(false),
              );
          }}
        >
          <Campo
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={justificando ? "Justificativa (obrigatória)" : "Motivo da falta (obrigatório)"}
            className="min-w-60 flex-1"
          />
          <Botao type="submit" variante={justificando ? "escuro" : "perigo"} tamanho="m" disabled={enviando || texto.trim().length < 3}>
            {justificando ? "Salvar justificativa" : "Lançar falta"}
          </Botao>
        </form>
      ) : null}
    </div>
  );
}

/** Pendência dentro do detalhe do dia: três caminhos quando falta uma batida, como no protótipo. */
export function PendenciaNoDia({ p, funcionariaId, data, editavel }: { p: Pendencia; funcionariaId: string; data: string; editavel: boolean }) {
  const { enviando, executar } = useAcao();
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const tipo = FALTANTE[p.codigo];
  const horaOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
  const motivoOk = motivo.trim().length >= 3;

  return (
    <div className={cn("flex flex-col gap-2.5 rounded-xl border bg-superficie p-3.5", p.severidade === "bloqueia" ? "border-perigo-borda" : "border-atencao-borda")}>
      <div className="flex items-center gap-2">
        <SeloSeveridade p={p} />
        <b className="text-[15px]">{p.titulo}</b>
      </div>
      <div className="text-sm text-pretty text-tinta-2">{p.descricao}</div>

      {editavel && tipo ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 rounded-[10px] border border-borda p-2.5">
              <b className="text-[13px]">Informar o horário</b>
              <Campo value={hora} onChange={(e) => setHora(mascaraHora(e.target.value))} placeholder="HH:MM" inputMode="numeric" className="text-[15px] font-bold" />
              <Botao
                variante="secundario"
                tamanho="p"
                disabled={enviando || !horaOk || !motivoOk}
                onClick={() => executar(() => lancarNoDia({ funcionariaId, data, motivo, lancamento: { tipo: "adicionar_batida", hora, tipoBatida: tipo } }))}
              >
                Salvar horário
              </Botao>
            </div>
            {p.sugestao.acoes.length ? (
              <div className="flex flex-col gap-1.5 rounded-[10px] border-2 border-terracota bg-[#fdf7f3] p-2.5">
                <b className="text-[13px] text-terracota-escuro">Sugestão do sistema</b>
                <span className="flex-1 text-[13px]">{p.sugestao.texto}. Fica registrada como ajuste.</span>
                <Botao tamanho="p" disabled={enviando} onClick={() => executar(() => aceitarSugestao({ funcionariaId, data, codigo: p.codigo }))}>
                  Aplicar
                </Botao>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 rounded-[10px] border border-borda p-2.5">
              <b className="text-[13px]">Manter como está</b>
              <span className="flex-1 text-[13px]">Conta só o primeiro período, como hoje. Exige justificativa.</span>
              <Botao
                variante="secundario"
                tamanho="p"
                disabled={enviando || !motivoOk}
                onClick={() => executar(() => justificarPendencia({ funcionariaId, data, codigo: p.codigo, justificativa: motivo }))}
              >
                Manter
              </Botao>
            </div>
          </div>
          <Campo value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo ou justificativa (obrigatório para informar ou manter)" />
        </>
      ) : editavel ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 rounded-lg bg-suave px-2.5 py-2 text-[13px]">
            <b className="text-terracota">Sugestão</b> {p.sugestao.texto}
          </span>
          {p.sugestao.acoes.length ? (
            <Botao tamanho="p" disabled={enviando} onClick={() => executar(() => aceitarSugestao({ funcionariaId, data, codigo: p.codigo }))}>
              {p.severidade === "aviso" ? "Confirmar" : "Aceitar"}
            </Botao>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
