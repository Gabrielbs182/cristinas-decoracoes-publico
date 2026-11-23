import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { faltaCodigo, INICIO_DO_PAPEL, obterSessao } from "@/lib/auth";

import { FormularioCodigo } from "./formulario";

export const metadata: Metadata = { title: "Código de verificação" };

/** Segunda etapa do login, para quem ligou a verificação em duas etapas. */
export default async function PaginaCodigo({ searchParams }: { searchParams: Promise<{ volta?: string }> }) {
  const sessao = await obterSessao();
  if (sessao) redirect(INICIO_DO_PAPEL[sessao.papel]);
  if (!(await faltaCodigo())) redirect("/login");
  const { volta } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-superficie px-6 py-10">
      <Image src="/logo-circulo.png" alt="Cristina's Decorações" width={160} height={160} priority className="size-28" />
      <FormularioCodigo volta={volta} />
    </main>
  );
}
