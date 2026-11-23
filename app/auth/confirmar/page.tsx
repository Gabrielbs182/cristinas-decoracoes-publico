import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FormSenha } from "@/components/conta/form-senha";

export const metadata: Metadata = { title: "Criar senha", robots: { index: false } };

/**
 * Página do link mandado pela gestora. Abrir NÃO valida o link (o WhatsApp abre sozinho para a prévia);
 * ele só é usado quando a pessoa envia a senha nova.
 */
export default async function ConfirmarAcesso({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token_hash: token, type } = await searchParams;
  const valido = typeof token === "string" && token.length >= 10 && type === "recovery";

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-superficie px-6 py-10">
      <Image src="/logo-circulo.png" alt="Cristina's Decorações" width={160} height={160} priority className="size-28" />
      {valido ? (
        <FormSenha tokenHash={token} titulo="Criar sua senha" subtitulo="Escolha a senha que você vai usar para entrar. Seu usuário está na mensagem que a gestora mandou." />
      ) : (
        <div className="flex max-w-[380px] flex-col gap-3 text-center">
          <h1 className="font-display text-[28px] font-normal">Link incompleto</h1>
          <p className="text-sm text-pretty text-tinta-3">Abra o link inteiro que a gestora mandou, ou peça um link novo a ela.</p>
          <Link href="/login" className="text-sm font-bold">
            Ir para o login
          </Link>
        </div>
      )}
    </main>
  );
}
