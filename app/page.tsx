import { redirect } from "next/navigation";

import { INICIO_DO_PAPEL, obterSessao } from "@/lib/auth";

export default async function Raiz() {
  const sessao = await obterSessao();
  redirect(sessao ? INICIO_DO_PAPEL[sessao.papel] : "/login");
}
