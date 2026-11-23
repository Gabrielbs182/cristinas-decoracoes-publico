import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormSenha } from "@/components/conta/form-senha";
import { obterSessao } from "@/lib/auth";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function TrocarSenha() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  const voltar = sessao.papel === "funcionaria" ? "/meu-ponto/perfil" : "/conta";

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-superficie px-6 py-10">
      <div className="flex w-full max-w-[380px]">
        <Link href={voltar} className="flex items-center gap-1 text-sm font-bold">
          <ChevronLeft className="size-4" /> Voltar
        </Link>
      </div>
      <FormSenha titulo="Trocar senha" subtitulo={`Usuário: ${sessao.login}. Depois de salvar, use a senha nova para entrar.`} />
    </main>
  );
}
