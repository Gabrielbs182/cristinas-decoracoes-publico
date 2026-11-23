"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { adicionarFeriado, removerFeriado, salvarRegras } from "@/app/(gestao)/ponto/calendario/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Campo, Selecao } from "@/components/ui/campos";

const TIPOS = [
  ["municipal", "Municipal"],
  ["ponte", "Ponte"],
  ["facultativo", "Ponto facultativo"],
  ["nacional", "Nacional"],
] as const;

export function NovoFeriado({ ano }: { ano: number }) {
  const { enviando, executar } = useAcao();
  const [data, setData] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number][0]>("municipal");

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-trilho px-4 py-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        executar(
          () => adicionarFeriado({ data, nome, tipo }),
          () => {
            setData("");
            setNome("");
          },
        );
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold">Data</span>
        <Campo type="date" value={data} onChange={(e) => setData(e.target.value)} min={`${ano}-01-01`} max={`${ano}-12-31`} className="w-40" />
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="text-xs font-bold">Nome</span>
        <Campo value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aniversário da cidade" maxLength={80} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold">Tipo</span>
        <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="w-44">
          {TIPOS.map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </Selecao>
      </label>
      <Botao type="submit" disabled={enviando || !data || nome.trim().length < 3}>
        <Plus /> Adicionar
      </Botao>
    </form>
  );
}

export function RemoverFeriado({ data, nome, travado }: { data: string; nome: string; travado: boolean }) {
  const { enviando, executar } = useAcao();
  return (
    <Botao
      variante="secundario"
      tamanho="icone"
      disabled={enviando || travado}
      title={travado ? "Semana já fechada: reabra para mudar" : `Remover ${nome}`}
      aria-label={`Remover ${nome}`}
      onClick={() => executar(() => removerFeriado({ data }))}
    >
      <Trash2 />
    </Botao>
  );
}

export interface ValoresRegras {
  cargaSegQui: string;
  cargaSex: string;
  entradaPrevista: string;
  almocoInicioPrevisto: string;
  almocoPadrao: string;
  horaCorte: string;
  toleranciaCorte: string;
  toleranciaAtraso: string;
  janelaDuplicada: string;
}

const CAMPOS: { campo: keyof ValoresRegras; rotulo: string; dica: string; minutos?: boolean }[] = [
  { campo: "cargaSegQui", rotulo: "Carga de seg. a qui.", dica: "por dia" },
  { campo: "cargaSex", rotulo: "Carga de sexta", dica: "por dia" },
  { campo: "almocoPadrao", rotulo: "Almoço padrão", dica: "almoço menor conta como este" },
  { campo: "entradaPrevista", rotulo: "Entrada prevista", dica: "para apontar atraso" },
  { campo: "almocoInicioPrevisto", rotulo: "Início previsto do almoço", dica: "ajuda a classificar as batidas" },
  { campo: "horaCorte", rotulo: "Hora de corte", dica: "banco que vira 1 dia pago" },
  { campo: "toleranciaCorte", rotulo: "Tolerância do corte", dica: "minutos", minutos: true },
  { campo: "toleranciaAtraso", rotulo: "Tolerância de atraso", dica: "minutos", minutos: true },
  { campo: "janelaDuplicada", rotulo: "Batida repetida", dica: "minutos para juntar duas batidas iguais", minutos: true },
];

const mascaraHora = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

export function FormRegras({ atuais, vigencia }: { atuais: ValoresRegras; vigencia: string }) {
  const { enviando, executar } = useAcao();
  const [v, setV] = useState(atuais);
  const mudou = CAMPOS.some(({ campo }) => v[campo] !== atuais[campo]);

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => salvarRegras(v));
      }}
    >
      {CAMPOS.map(({ campo, rotulo, dica, minutos }) => (
        <label key={campo} className="flex items-center justify-between gap-3 border-b border-trilho px-4 py-2.5">
          <span className="flex flex-col">
            <b className="text-sm">{rotulo}</b>
            <span className="text-xs text-tinta-3">{dica}</span>
          </span>
          <Campo
            value={v[campo]}
            onChange={(e) => setV((x) => ({ ...x, [campo]: minutos ? e.target.value.replace(/\D/g, "").slice(0, 3) : mascaraHora(e.target.value) }))}
            inputMode="numeric"
            aria-label={rotulo}
            className="w-24 text-right font-bold tabular-nums"
          />
        </label>
      ))}
      <div className="flex flex-col gap-2 px-4 py-3.5">
        <Botao type="submit" disabled={enviando || !mudou} className="self-start">
          Salvar regras
        </Botao>
        <span className="text-xs text-pretty text-tinta-3">{vigencia}</span>
      </div>
    </form>
  );
}
