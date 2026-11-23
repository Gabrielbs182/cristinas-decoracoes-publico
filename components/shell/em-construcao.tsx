import { Hammer } from "lucide-react";
import Link from "next/link";

import { estilosBotao } from "@/components/ui/botao";
import { EstadoVazio, TituloPagina } from "@/components/ui/cartao";

/** Tela que ainda não foi construída: diz o que vem e não finge funcionar. */
export function EmConstrucao({ contexto, titulo, oQueVem, voltar = { href: "/inicio", rotulo: "Voltar ao início" } }: {
  contexto: string;
  titulo: string;
  oQueVem: string;
  voltar?: { href: string; rotulo: string } | null;
}) {
  return (
    <>
      <TituloPagina contexto={contexto} titulo={titulo} />
      <EstadoVazio
        icone={<Hammer />}
        titulo="Chega na próxima etapa"
        acao={
          voltar ? (
            <Link href={voltar.href} className={estilosBotao({ variante: "secundario" })}>
              {voltar.rotulo}
            </Link>
          ) : null
        }
      >
        {oQueVem}
      </EstadoVazio>
    </>
  );
}
