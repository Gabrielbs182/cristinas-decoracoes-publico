import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TituloPortal } from "@/components/portal/titulo";
import { estilosBotao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { pendenciasAbertasDaFuncionaria } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Minhas pendências" };

export default async function MinhasPendencias() {
  const sessao = await exigirPapel("funcionaria");
  const supabase = await criarClienteServidor();
  const pendencias = await pendenciasAbertasDaFuncionaria(supabase, sessao.funcionariaId!);

  return (
    <>
      <TituloPortal contexto="O que precisa da sua atenção" titulo="Minhas pendências" />
      {!pendencias.length ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border border-borda bg-superficie px-[18px] py-7 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-sucesso-fundo text-sucesso">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <b className="text-[17px]">Tudo certo com o seu ponto</b>
          <span className="text-sm text-tinta-3">Se alguma batida estiver errada, você pode pedir correção.</span>
          <Link href="/meu-ponto/corrigir" className={estilosBotao({ variante: "secundario", className: "mt-1.5 h-11" })}>
            Pedir correção
          </Link>
        </div>
      ) : (
        pendencias.map((p) => (
          <div key={p.data + p.codigo} className="flex flex-col gap-2.5 rounded-[14px] border border-perigo-borda bg-superficie p-4">
            {p.pedidoEnviado ? (
              <Selo tom="atencao" icone="relogio" tamanho="g">
                Correção enviada · aguardando
              </Selo>
            ) : (
              <Selo tom="perigo" icone="alerta" tamanho="g">
                Pendente
              </Selo>
            )}
            <span className="text-[17px] leading-snug font-bold text-pretty">{p.texto}</span>
            <span className="text-[13px] text-tinta-3">Batidas do dia: {p.batidas.join(" · ") || "nenhuma"}</span>
            {!p.pedidoEnviado ? (
              <Link
                href={`/meu-ponto/corrigir?dia=${p.data}${p.tipoSugerido ? `&tipo=${p.tipoSugerido}` : ""}`}
                className={estilosBotao({ tamanho: "g", className: "font-extrabold" })}
              >
                Informar horário
              </Link>
            ) : null}
          </div>
        ))
      )}
    </>
  );
}
