"use client";

import { Check, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { rotuloSemana } from "@/components/ponto/barra-semana";
import { Botao, estilosBotao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Selecao } from "@/components/ui/campos";
import { Selo } from "@/components/ui/selo";
import { dataBr, diaMes } from "@/lib/ponto";
import { cn } from "@/lib/utils";

import { confirmarImportacao, type Previa, previaImportacao, type ResumoImportacao } from "./acoes";

type Etapa = { nome: "vazio" } | { nome: "previa"; arquivo: File; previa: Previa } | { nome: "feito"; resumo: ResumoImportacao };

export function Importador({ funcionariasSemId }: { funcionariasSemId: { id: string; nome: string }[] }) {
  const [etapa, setEtapa] = useState<Etapa>({ nome: "vazio" });
  const [lendo, iniciar] = useTransition();
  const [arrastando, setArrastando] = useState(false);
  const [decisoes, setDecisoes] = useState<Record<string, string>>({});
  const entrada = useRef<HTMLInputElement>(null);

  function ler(arquivo: File | undefined) {
    if (!arquivo) return;
    iniciar(async () => {
      const fd = new FormData();
      fd.set("arquivo", arquivo);
      const r = await previaImportacao(fd);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setDecisoes(Object.fromEntries(r.dados.desconhecidos.map((d) => [d.enNo, "depois"])));
      setEtapa({ nome: "previa", arquivo, previa: r.dados });
    });
  }

  function confirmar(arquivo: File) {
    iniciar(async () => {
      const fd = new FormData();
      fd.set("arquivo", arquivo);
      fd.set("decisoes", JSON.stringify(decisoes));
      const r = await confirmarImportacao(fd);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(`${r.dados.novas} batidas importadas`);
      setEtapa({ nome: "feito", resumo: r.dados });
    });
  }

  if (etapa.nome === "vazio") {
    return (
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          ler(e.dataTransfer.files[0]);
        }}
        disabled={lendo}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2.5 rounded-[14px] border-2 border-dashed bg-superficie px-6 py-12 text-center",
          arrastando ? "border-terracota bg-[#fdf9f5]" : "border-tracejado hover:border-terracota hover:bg-[#fdf9f5]",
        )}
      >
        <div className="grid size-13 place-items-center rounded-full bg-terracota-claro text-terracota">
          <Upload className="size-6" />
        </div>
        <div className="font-display text-[21px] font-medium">{lendo ? "Lendo o arquivo…" : "Arraste o arquivo .txt da catraca aqui"}</div>
        <div className="text-sm text-tinta-3">
          ou <u className="font-bold text-terracota">escolha no computador</u>. Antes de gravar, você vê uma prévia do que foi lido.
        </div>
        <input ref={entrada} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => ler(e.target.files?.[0])} />
      </button>
    );
  }

  if (etapa.nome === "feito") {
    const { resumo } = etapa;
    return (
      <Cartao className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-sucesso text-white">
            <Check className="size-5" />
          </span>
          <div className="flex flex-col">
            <b className="text-[17px]">Importação concluída · {resumo.novas} batidas novas</b>
            <span className="text-[13px] text-tinta-3">As semanas foram validadas automaticamente. Tipos de batida errados da catraca foram corrigidos pelo horário, sem virar pendência.</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {resumo.semanas.map((s) => (
            <div key={s.segunda} className="flex flex-wrap items-center gap-3 rounded-[10px] bg-suave px-3.5 py-3">
              <b className="min-w-44">{rotuloSemana(s.segunda)}</b>
              <Selo tom="ok" icone="check">
                {s.diasOk} dias OK
              </Selo>
              <Selo tom="perigo" icone="alerta">
                {s.bloqueios} bloqueiam
              </Selo>
              <Selo tom="atencao" icone="alerta">
                {s.avisos} avisos
              </Selo>
              <span className="text-xs text-tinta-3">{s.corrigidos} tipos corrigidos</span>
              <span className="flex-1" />
              <Link href={`/ponto/semana?s=${s.segunda}`} className={estilosBotao({ variante: "secundario", tamanho: "p" })}>
                Ver a semana
              </Link>
              {s.bloqueios + s.avisos ? (
                <Link href={`/ponto/pendencias?s=${s.segunda}`} className={estilosBotao({ tamanho: "p" })}>
                  Revisar pendências
                </Link>
              ) : null}
            </div>
          ))}
          {resumo.semanasSemResumo ? <span className="text-[13px] text-tinta-3">+ {resumo.semanasSemResumo} semana(s) mais antigas também importadas.</span> : null}
        </div>
        <Botao variante="secundario" className="self-start" onClick={() => setEtapa({ nome: "vazio" })}>
          Importar outro arquivo
        </Botao>
      </Cartao>
    );
  }

  const { previa, arquivo } = etapa;
  const stats = [
    { l: "Período", v: `${diaMes(previa.periodo.inicio)} a ${diaMes(previa.periodo.fim)}`, d: `${previa.semanas.length} semana(s)` },
    { l: "Batidas lidas", v: String(previa.batidasLidas), d: `${previa.novas} novas · ${previa.repetidas} já importadas` },
    { l: "Funcionárias", v: String(previa.funcionarias.length), d: previa.funcionarias.map((f) => f.nome).join(", ") || "—" },
    { l: "Problemas", v: String(previa.desconhecidos.length + previa.erros.length), d: `${previa.desconhecidos.length} ID desconhecido · ${previa.erros.length} linha(s) com erro` },
  ];

  return (
    <Cartao className="flex flex-col gap-4 p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <b className="text-base">Prévia · {previa.arquivo}</b>
          <span className="text-[13px] text-tinta-3">Nada foi gravado ainda.</span>
        </div>
        <span className="text-[13px] text-tinta-3">
          {previa.tamanhoKb.toLocaleString("pt-BR")} KB · {previa.linhasLidas} linhas
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="flex flex-col gap-1 rounded-[10px] bg-suave p-3">
            <span className="text-xs font-semibold text-tinta-3">{s.l}</span>
            <b className="text-xl">{s.v}</b>
            <span className="text-xs text-tinta-3">{s.d}</span>
          </div>
        ))}
      </div>

      {previa.emSemanaFechada ? (
        <div className="rounded-[10px] bg-atencao-fundo px-3.5 py-2.5 text-sm text-atencao">
          {previa.emSemanaFechada} batida(s) caem em semana já fechada e <b>não serão importadas</b>. Reabra a semana se precisar delas.
        </div>
      ) : null}

      {previa.funcionarias.some((f) => !f.ativa) ? (
        <div className="rounded-[10px] bg-neutro-fundo px-3.5 py-2.5 text-sm text-neutro">
          Batidas de funcionária inativa ({previa.funcionarias.filter((f) => !f.ativa).map((f) => f.nome).join(", ")}) são guardadas, mas não aparecem na semana.
        </div>
      ) : null}

      {previa.desconhecidos.length ? (
        <div className="flex flex-col gap-2">
          <b className="text-sm">IDs desconhecidos ({previa.desconhecidos.length})</b>
          {previa.desconhecidos.map((d) => (
            <div key={d.enNo} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-perigo-borda bg-[#fdf3f4] p-3">
              <Selo tom="perigo" icone="alerta">
                Bloqueia
              </Selo>
              <b className="text-sm">ID {d.enNo.replace(/^0+/, "")}</b>
              <span className="min-w-48 flex-1 text-sm text-tinta-2">{d.exemplo}</span>
              <Selecao value={decisoes[d.enNo] ?? "depois"} onChange={(e) => setDecisoes((x) => ({ ...x, [d.enNo]: e.target.value }))} className="w-auto">
                <option value="depois">Decidir depois (vira pendência)</option>
                <option value="ignorar">Ignorar este ID</option>
                {funcionariasSemId.map((f) => (
                  <option key={f.id} value={f.id}>
                    Vincular a {f.nome}
                  </option>
                ))}
              </Selecao>
            </div>
          ))}
        </div>
      ) : null}

      {previa.erros.length ? (
        <div className="flex flex-col gap-2">
          <b className="text-sm">Linhas com erro ({previa.erros.length}) — serão ignoradas</b>
          <div className="overflow-hidden rounded-[10px] border border-trilho text-[13px]">
            {previa.erros.map((e) => (
              <div key={e.linha} className="grid grid-cols-[80px_minmax(0,1.3fr)_1fr] gap-2.5 border-b border-trilho px-3 py-2 last:border-b-0">
                <span>Linha {e.linha}</span>
                <span className="truncate font-mono">{e.conteudo.replace(/\t/g, " · ")}</span>
                <span>{e.motivo}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <span className="mr-auto text-[13px] text-tinta-3">
          Período {dataBr(previa.periodo.inicio)} a {dataBr(previa.periodo.fim)}
        </span>
        <Botao variante="secundario" onClick={() => setEtapa({ nome: "vazio" })} disabled={lendo}>
          Cancelar
        </Botao>
        <Botao onClick={() => confirmar(arquivo)} disabled={lendo || previa.novas === 0}>
          {lendo ? "Importando…" : previa.novas ? `Confirmar importação de ${previa.novas} batidas` : "Nada novo para importar"}
        </Botao>
      </div>
    </Cartao>
  );
}
