import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { faltaCodigo, INICIO_DO_PAPEL, obterSessao } from "@/lib/auth";
import { VERSAO } from "@/lib/versao";

import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ volta?: string }> }) {
  const sessao = await obterSessao();
  if (sessao) redirect(INICIO_DO_PAPEL[sessao.papel]);
  const { volta } = await searchParams;
  if (await faltaCodigo()) redirect(volta ? `/login/codigo?volta=${encodeURIComponent(volta)}` : "/login/codigo");

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="grid place-items-center bg-creme px-6 py-10">
        <Image src="/logo-circulo.png" alt="Cristina's Decorações" width={420} height={420} priority className="size-56 lg:size-[420px]" />
      </div>
      <div className="flex flex-col items-center justify-start gap-6 bg-superficie px-6 py-10 lg:justify-center">
        <FormularioLogin volta={volta} />
        <span className="text-xs text-tinta-3">Versão {VERSAO}</span>
      </div>
    </main>
  );
}
