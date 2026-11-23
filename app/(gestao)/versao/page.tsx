import { Check, Circle } from "lucide-react";
import type { Metadata } from "next";

import { Cartao, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { DEPOIS_DA_1_0, progresso, ROADMAP, type StatusVersao, versaoAtual } from "@/lib/roadmap";
import { cn } from "@/lib/utils";
import { VERSAO } from "@/lib/versao";

export const metadata: Metadata = { title: "Versão e novidades" };

const dataBr = (d: string) => d.split("-").reverse().join("/");

const SELO: Record<StatusVersao, React.ReactNode> = {
  lancada: (
    <Selo tom="ok" icone="check">
      Lançada
    </Selo>
  ),
  proxima: (
    <Selo tom="marca" icone="relogio">
      Próxima
    </Selo>
  ),
  planejada: (
    <Selo tom="neutro" icone="circulo">
      Planejada
    </Selo>
  ),
};

export default async function PaginaVersao() {
  await exigirPapel("gestora", "contador");
  const atual = versaoAtual();
  const p = progresso();

  return (
    <div className="flex max-w-[980px] flex-col gap-4">
      <TituloPagina contexto="Sistema" titulo="Versão e novidades" />

      <Cartao className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-tinta-3">Você está usando a versão</span>
            <b className="text-5xl leading-none tracking-tight">{VERSAO}</b>
            <span className="text-sm text-tinta-2">
              {atual.titulo}
              {atual.data ? ` · lançada em ${dataBr(atual.data)}` : ""}
            </span>
          </div>
          <div className="flex min-w-64 flex-1 flex-col gap-2 sm:max-w-sm">
            <div className="flex justify-between text-[13px]">
              <span className="font-semibold text-tinta-2">Caminho até a versão 1.0</span>
              <b>{p.percentual}%</b>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-terracota-claro"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={p.total}
              aria-valuenow={p.feitas}
              aria-label="Entregas feitas até a 1.0"
            >
              <div className="h-full rounded-full bg-terracota" style={{ width: `${p.percentual}%` }} />
            </div>
            <span className="text-xs text-tinta-3">
              {p.feitas} de {p.total} entregas feitas. A 1.0 é o sistema no ar, com os dados reais e cópia de segurança.
            </span>
          </div>
        </div>
      </Cartao>

      <ol className="flex flex-col gap-3">
        {ROADMAP.map((v) => {
          const corrente = v.versao === VERSAO;
          const feitas = v.entregas.filter((e) => e.feito).length;
          return (
            <li key={v.versao}>
              <Cartao className={cn("flex flex-col gap-3 p-4", corrente && "border-terracota ring-1 ring-terracota", v.status === "planejada" && "bg-suave")}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <b className="font-display text-xl font-medium">
                    {v.versao} · {v.titulo}
                  </b>
                  {SELO[v.status]}
                  {corrente ? <span className="text-xs font-bold text-terracota">versão em uso</span> : null}
                  <span className="ml-auto text-xs text-tinta-3">
                    {v.data ? `lançada em ${dataBr(v.data)}` : `${feitas} de ${v.entregas.length} entregas`}
                  </span>
                </div>
                <p className="text-sm text-pretty text-tinta-2">{v.objetivo}</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {v.entregas.map((e) => (
                    <li key={e.texto} className="flex items-start gap-2 text-[13px]">
                      {e.feito ? (
                        <span className="mt-px grid size-4 flex-none place-items-center rounded-full bg-sucesso text-white" aria-label="feito">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      ) : (
                        <Circle className="mt-px size-4 flex-none text-tinta-4" aria-label="a fazer" />
                      )}
                      <span className={cn(e.feito ? "text-tinta" : "text-tinta-2")}>{e.texto}</span>
                    </li>
                  ))}
                </ul>
              </Cartao>
            </li>
          );
        })}
      </ol>

      <Cartao className="flex flex-col gap-2 p-4">
        <b className="text-[15px]">Depois da 1.0</b>
        <span className="text-[13px] text-tinta-2">Combinado no início do projeto como fora do escopo da primeira versão: {DEPOIS_DA_1_0.join(", ").toLowerCase()}.</span>
      </Cartao>
    </div>
  );
}
