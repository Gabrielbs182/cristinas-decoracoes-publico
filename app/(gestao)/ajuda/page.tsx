import type { Metadata } from "next";

import { TopicosDoGuia } from "@/components/guia/topicos";
import { TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { GUIA_CONTADOR, GUIA_GESTORA } from "@/lib/guia";

export const metadata: Metadata = { title: "Como usar" };

export default async function PaginaAjuda() {
  const sessao = await exigirPapel("gestora", "contador");
  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <TituloPagina contexto="Guia rápido" titulo="Como usar o sistema" />
      <TopicosDoGuia topicos={sessao.papel === "contador" ? GUIA_CONTADOR : GUIA_GESTORA} />
    </div>
  );
}
