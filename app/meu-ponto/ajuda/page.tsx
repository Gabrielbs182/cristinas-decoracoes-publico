import type { Metadata } from "next";

import { TopicosDoGuia } from "@/components/guia/topicos";
import { TituloPortal } from "@/components/portal/titulo";
import { exigirPapel } from "@/lib/auth";
import { GUIA_FUNCIONARIA } from "@/lib/guia";

export const metadata: Metadata = { title: "Como usar" };

export default async function AjudaDoPortal() {
  await exigirPapel("funcionaria");
  return (
    <>
      <TituloPortal contexto="Guia rápido" titulo="Como usar o seu ponto" />
      <TopicosDoGuia topicos={GUIA_FUNCIONARIA} />
    </>
  );
}
