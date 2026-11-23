import { ChevronRight, CircleHelp, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DuasEtapas } from "@/components/conta/duas-etapas";
import { FormNome } from "@/components/conta/form-nome";
import { TituloPortal } from "@/components/portal/titulo";
import { exigirPapel } from "@/lib/auth";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function MeuPerfil() {
  const sessao = await exigirPapel("funcionaria");

  return (
    <>
      <TituloPortal contexto={`Usuário: ${sessao.login}`} titulo="Meu perfil" />
      <div className="rounded-[14px] border border-borda bg-superficie p-4">
        <FormNome atual={sessao.nome} grande dica="É assim que o seu nome aparece no ponto, nos espelhos e para a gestora." />
      </div>
      <Link href="/definir-senha" className="flex min-h-14 items-center gap-3 rounded-[14px] border border-borda bg-superficie px-4 text-[15px] font-bold text-tinta no-underline">
        <KeyRound className="size-5 text-tinta-3" />
        <span className="flex-1">Trocar senha</span>
        <ChevronRight className="size-5 text-tinta-3" />
      </Link>
      <div className="flex flex-col gap-2 rounded-[14px] border border-borda bg-superficie p-4">
        <b className="text-[15px]">Verificação em duas etapas</b>
        <DuasEtapas ligada={sessao.duasEtapas} />
      </div>
      <Link href="/meu-ponto/ajuda" className="flex min-h-14 items-center gap-3 rounded-[14px] border border-borda bg-superficie px-4 text-[15px] font-bold text-tinta no-underline">
        <CircleHelp className="size-5 text-tinta-3" />
        <span className="flex-1">Como usar o seu ponto</span>
        <ChevronRight className="size-5 text-tinta-3" />
      </Link>
    </>
  );
}
