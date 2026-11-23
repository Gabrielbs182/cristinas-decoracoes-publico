import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DuasEtapas } from "@/components/conta/duas-etapas";
import { FormNome } from "@/components/conta/form-nome";
import { estilosBotao } from "@/components/ui/botao";
import { Cartao, TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";

export const metadata: Metadata = { title: "Minha conta" };

export default async function MinhaConta() {
  const sessao = await exigirPapel("gestora", "contador");

  return (
    <>
      <TituloPagina contexto={`Usuário: ${sessao.login}`} titulo="Minha conta" />
      <Cartao className="flex max-w-xl flex-col gap-5 p-5">
        <FormNome atual={sessao.nome} dica="É o nome que aparece no menu e no histórico do que você lançou." />
        <div className="flex flex-col gap-1.5 border-t border-trilho pt-4">
          <b className="text-sm">Senha</b>
          <Link href="/definir-senha" className={estilosBotao({ variante: "secundario", className: "self-start" })}>
            <KeyRound /> Trocar senha
          </Link>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-trilho pt-4">
          <b className="text-sm">Verificação em duas etapas</b>
          <DuasEtapas ligada={sessao.duasEtapas} />
        </div>
      </Cartao>
    </>
  );
}
