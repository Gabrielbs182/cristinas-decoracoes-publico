"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { type EntradaLancamento, lancarNoDia } from "@/app/(gestao)/ponto/acoes";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Selecao } from "@/components/ui/campos";
import { PainelLateral } from "@/components/ui/painel-lateral";
import { dataBr, NOME_DIA, NOME_OCORRENCIA, NOME_TIPO, type Ocorrencia, type ResultadoDia, type TipoBatida } from "@/lib/ponto";
import type { ItemHistorico } from "@/lib/ponto/historico";
import { cn } from "@/lib/utils";

import { LinhaDoTempo } from "./linha-do-tempo";
import { PendenciaNoDia } from "./pendencia";
import { SeloSituacao } from "./selo-situacao";
import { useAcao } from "./usar-acao";

type Modo = "adicionar_batida" | "alterar_horario" | "desconsiderar_batida" | "trocar_tipo" | "ocorrencia";
const MODOS: [Modo, string][] = [
  ["adicionar_batida", "Adicionar batida"],
  ["alterar_horario", "Editar horário"],
  ["desconsiderar_batida", "Desconsiderar"],
  ["trocar_tipo", "Trocar tipo"],
  ["ocorrencia", "Ocorrência"],
];

const mascaraHora = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

function Sobretitulo({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold tracking-[.06em] text-tinta-3 uppercase">{children}</div>;
}

function AlterarDia({ funcionariaId, dia }: { funcionariaId: string; dia: ResultadoDia }) {
  const { enviando, executar } = useAcao();
  const [modo, setModo] = useState<Modo>("adicionar_batida");
  const [ref, setRef] = useState("");
  const [hora, setHora] = useState("");
  const [tipo, setTipo] = useState<TipoBatida>("V");
  const [ocorrencia, setOcorrencia] = useState<Ocorrencia>("atestado");
  const [motivo, setMotivo] = useState("");

  const precisa = {
    batida: modo === "alterar_horario" || modo === "desconsiderar_batida" || modo === "trocar_tipo",
    hora: modo === "adicionar_batida" || modo === "alterar_horario",
    tipo: modo === "adicionar_batida" || modo === "trocar_tipo",
    ocorrencia: modo === "ocorrencia",
  };
  const valido =
    motivo.trim().length >= 3 && (!precisa.hora || /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) && (!precisa.batida || !!ref);
  const opcoesBatida = dia.batidas.filter((b) => !b.desconsiderada);

  function lancamento(): EntradaLancamento {
    switch (modo) {
      case "adicionar_batida":
        return { tipo: modo, hora, tipoBatida: tipo };
      case "alterar_horario":
        return { tipo: modo, ref, hora };
      case "desconsiderar_batida":
        return { tipo: modo, ref };
      case "trocar_tipo":
        return { tipo: modo, ref, tipoBatida: tipo };
      case "ocorrencia":
        return { tipo: modo, ocorrencia };
    }
  }

  return (
    <form
      className="flex flex-col gap-2.5 rounded-xl border border-borda bg-superficie p-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => lancarNoDia({ funcionariaId, data: dia.data, motivo, lancamento: lancamento() }), () => {
          setMotivo("");
          setHora("");
          setRef("");
        });
      }}
    >
      <Sobretitulo>Alterar o dia</Sobretitulo>
      <div className="flex flex-wrap gap-1 rounded-[9px] bg-segmento p-[3px]" role="tablist">
        {MODOS.map(([m, rotulo]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => setModo(m)}
            className={cn("h-8 cursor-pointer rounded-[7px] px-2.5 text-xs font-bold", modo === m ? "bg-superficie shadow-sm" : "bg-transparent")}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {precisa.batida ? (
          <Selecao value={ref} onChange={(e) => setRef(e.target.value)} className="w-auto min-w-44" aria-label="Qual batida">
            <option value="">Qual batida?</option>
            {opcoesBatida.map((b) => (
              <option key={b.ref} value={b.ref}>
                {b.hora} · {b.tipo ? NOME_TIPO[b.tipo] : "fora do cálculo"}
              </option>
            ))}
          </Selecao>
        ) : null}
        {precisa.hora ? (
          <Campo value={hora} onChange={(e) => setHora(mascaraHora(e.target.value))} placeholder="HH:MM" inputMode="numeric" className="w-24 text-[15px] font-bold" aria-label="Horário" />
        ) : null}
        {precisa.tipo ? (
          <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as TipoBatida)} className="w-auto" aria-label="Tipo">
            {(Object.keys(NOME_TIPO) as TipoBatida[]).map((t) => (
              <option key={t} value={t}>
                {NOME_TIPO[t]}
              </option>
            ))}
          </Selecao>
        ) : null}
        {precisa.ocorrencia ? (
          <Selecao value={ocorrencia} onChange={(e) => setOcorrencia(e.target.value as Ocorrencia)} className="w-auto" aria-label="Ocorrência">
            {(Object.keys(NOME_OCORRENCIA) as Ocorrencia[]).map((o) => (
              <option key={o} value={o}>
                {NOME_OCORRENCIA[o]}
              </option>
            ))}
          </Selecao>
        ) : null}
      </div>
      <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo da alteração (obrigatório)" />
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-xs text-tinta-3">A batida original da catraca nunca é apagada.</span>
        <Botao type="submit" disabled={enviando || !valido}>
          Salvar alteração
        </Botao>
      </div>
    </form>
  );
}

function Historico({ itens, funcionariaId, data, editavel }: { itens: ItemHistorico[]; funcionariaId: string; data: string; editavel: boolean }) {
  const { enviando, executar } = useAcao();
  const [desfazendo, setDesfazendo] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <Sobretitulo>Histórico do dia</Sobretitulo>
      {!itens.length ? <div className="text-[13px] text-tinta-3">Sem alterações. Batidas como vieram da catraca.</div> : null}
      {itens.map((h) => (
        <div key={h.id} className="flex flex-col gap-1.5 border-t border-trilho py-2 text-[13px]">
          <div className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-start gap-2.5">
            <span className="text-tinta-3">{h.quando}</span>
            <span className={cn(h.desfeito && "text-tinta-4 line-through")}>
              <b>{h.quem}</b> · {h.texto} — <i>{h.motivo}</i>
            </span>
            {editavel && h.reversivel ? (
              <button type="button" onClick={() => setDesfazendo(desfazendo === h.id ? null : h.id)} className="cursor-pointer text-xs font-bold text-terracota">
                Desfazer
              </button>
            ) : null}
          </div>
          {desfazendo === h.id ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                executar(() => lancarNoDia({ funcionariaId, data, motivo, lancamento: { tipo: "cancelar", lancamentoId: h.id } }), () => {
                  setDesfazendo(null);
                  setMotivo("");
                });
              }}
            >
              <Campo autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que desfazer? (obrigatório)" />
              <Botao type="submit" variante="escuro" disabled={enviando || motivo.trim().length < 3}>
                Desfazer
              </Botao>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DetalheDia({
  funcionaria,
  dia,
  historico,
  editavel,
  urlFechar,
}: {
  funcionaria: { id: string; nome: string };
  dia: ResultadoDia;
  historico: ItemHistorico[];
  editavel: boolean;
  urlFechar: string;
}) {
  const router = useRouter();
  return (
    <PainelLateral
      aberto
      aoFechar={() => router.push(urlFechar, { scroll: false })}
      subtitulo={`${NOME_DIA[dia.dow]}, ${dataBr(dia.data)}${dia.feriado ? ` · ${dia.feriado}` : ""}`}
      titulo={funcionaria.nome}
      extra={<SeloSituacao situacao={dia.situacao} />}
    >
      <LinhaDoTempo dia={dia} />
      <div className="rounded-[10px] bg-tinta px-3.5 py-3 text-sm font-semibold text-white">{dia.calculo}</div>

      {dia.pendencias.map((p) => (
        <PendenciaNoDia key={p.codigo} p={p} funcionariaId={funcionaria.id} data={dia.data} editavel={editavel} />
      ))}

      <div className="flex flex-col gap-2">
        <Sobretitulo>Batidas</Sobretitulo>
        <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
          {!dia.batidas.length ? <div className="px-3.5 py-3 text-[13px] text-tinta-3">Nenhuma batida neste dia.</div> : null}
          {dia.batidas.map((b) => {
            const riscada = b.desconsiderada || !!b.duplicadaDe;
            const origem = b.origem === "manual" ? { l: "Manual", c: "bg-info-fundo text-info" } : b.ajustada ? { l: "Ajustada", c: "bg-ajuste-fundo text-ajuste" } : { l: "Catraca", c: "bg-neutro-fundo text-neutro" };
            return (
              <div key={b.ref} className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-3 border-b border-trilho px-3.5 py-2.5 last:border-b-0">
                <span className={cn("text-[17px] font-extrabold", riscada && "text-tinta-4 line-through")}>{b.hora}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <b className="text-sm">{riscada ? "Desconsiderada" : b.excedente ? "Excedente (fora da conta)" : b.tipo ? NOME_TIPO[b.tipo] : "—"}</b>
                  {b.horaOriginal ? (
                    <span className="text-xs text-tinta-3">
                      original da catraca: <s>{b.horaOriginal}</s>
                    </span>
                  ) : null}
                  {b.tipoCorrigido && b.tipoCatraca ? (
                    <span className="text-xs text-tinta-3">↻ tipo corrigido automaticamente (catraca: {NOME_TIPO[b.tipoCatraca].toLowerCase()})</span>
                  ) : null}
                  {b.duplicadaDe ? <span className="text-xs text-perigo">Duplicada · unificada automaticamente</span> : null}
                  {b.desconsiderada && b.motivoDesconsiderada ? <span className="text-xs text-perigo">Motivo: {b.motivoDesconsiderada}</span> : null}
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-extrabold", origem.c)}>{origem.l}</span>
              </div>
            );
          })}
        </div>
      </div>

      {dia.resolvidas.length ? (
        <div className="flex flex-col gap-1.5">
          <Sobretitulo>Resolvidas</Sobretitulo>
          {dia.resolvidas.map((p) => (
            <div key={p.codigo} className="rounded-lg bg-sucesso-fundo px-3 py-2 text-[13px] text-sucesso">
              <b>{p.titulo}</b> — {p.resolucao?.motivo}
            </div>
          ))}
        </div>
      ) : null}

      {editavel ? <AlterarDia funcionariaId={funcionaria.id} dia={dia} /> : null}
      <Historico itens={historico} funcionariaId={funcionaria.id} data={dia.data} editavel={editavel} />
    </PainelLateral>
  );
}
