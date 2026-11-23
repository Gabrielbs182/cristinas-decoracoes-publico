import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { estilosBotao } from "@/components/ui/botao";
import { INICIO_DO_PAPEL, obterSessao } from "@/lib/auth";

export const metadata: Metadata = { title: "Sem permissão" };

const DESCRICAO = {
  gestora: "a área da gestora",
  funcionaria: "o seu ponto, o seu banco de horas e os seus espelhos",
  contador: "os relatórios de RH e os recibos, sem editar",
} as const;

export default async function SemPermissao() {
  const sessao = await obterSessao();
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-3 rounded-2xl border border-borda bg-superficie p-6 text-center sm:p-8">
        <div className="grid size-14 place-items-center rounded-full bg-neutro-fundo text-neutro">
          <Lock className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-medium">Esta página não está disponível para você</h1>
        {sessao ? (
          <p className="text-sm text-pretty text-tinta-3">
            Com o seu acesso você vê {DESCRICAO[sessao.papel]}.
          </p>
        ) : null}
        <Link href={sessao ? INICIO_DO_PAPEL[sessao.papel] : "/login"} className={estilosBotao({ className: "mt-1.5 h-11" })}>
          {sessao?.papel === "funcionaria" ? "Ir para o meu ponto" : "Voltar ao início"}
        </Link>
        <span className="text-xs text-tinta-3">Acha que deveria ter acesso? Fale com a Cristina.</span>
      </div>
    </main>
  );
}
