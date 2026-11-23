"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";

import { cn } from "@/lib/utils";

export interface ItemNav {
  href: string;
  rotulo: string;
  contador?: { n: number; tom: "perigo" | "info" };
}
export interface GrupoNav {
  rotulo?: string;
  itens: ItemNav[];
}

function Marca() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-[46px] flex-none place-items-center rounded-full border border-borda bg-creme">
        <Image src="/icone-cortina.png" alt="" width={34} height={28} className="h-7 w-auto" />
      </div>
      <div className="flex flex-col gap-px">
        <span className="font-display text-[22px] leading-none font-light">Cristina&apos;s</span>
        <span className="text-[9px] font-semibold tracking-[.32em] text-tinta-2">DECORAÇÕES</span>
      </div>
    </div>
  );
}

function Lista({ grupos, aoNavegar }: { grupos: GrupoNav[]; aoNavegar?: () => void }) {
  const caminho = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-auto px-2.5 py-3" aria-label="Menu principal">
      {grupos.map((g, i) => (
        <div key={g.rotulo ?? i} className="flex flex-col gap-0.5">
          {g.rotulo ? <div className="px-2.5 pt-3.5 pb-1.5 text-[11px] font-extrabold tracking-[.08em] text-tinta-3">{g.rotulo}</div> : null}
          {g.itens.map((item) => {
            const ativo = caminho === item.href || caminho.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={aoNavegar}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-[#f1eae0]",
                  ativo ? "bg-terracota-claro font-extrabold text-terracota-escuro" : "font-semibold text-tinta",
                )}
              >
                <span className={cn("h-[18px] w-[3px] rounded-sm", ativo ? "bg-terracota" : "bg-transparent")} />
                <span className="flex-1">{item.rotulo}</span>
                {item.contador && item.contador.n > 0 ? (
                  <span
                    className={cn(
                      "grid h-5 min-w-[22px] place-items-center rounded-full px-1.5 text-[11px] font-extrabold text-white",
                      item.contador.tom === "perigo" ? "bg-perigo" : "bg-info",
                    )}
                  >
                    {item.contador.n}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Rodape({ nome, papel, sair, versao }: { nome: string; papel: string; sair: () => Promise<void>; versao: string }) {
  return (
    <div className="border-t border-trilho">
    <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
      <Link href="/conta" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-tinta no-underline hover:text-terracota" title="Minha conta">
        <div className="grid size-9 flex-none place-items-center rounded-full bg-terracota-claro font-extrabold text-terracota">{nome.slice(0, 1).toUpperCase()}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[13px]">{nome}</b>
          <span className="text-xs text-tinta-3">{papel}</span>
        </div>
      </Link>
      <form action={sair}>
        <button type="submit" className="h-8 cursor-pointer rounded-md border border-borda-campo bg-superficie px-2.5 text-xs font-bold">
          Sair
        </button>
      </form>
    </div>
      <Link href="/versao" className="block px-3.5 pb-2.5 text-[11px] font-semibold text-tinta-3 hover:text-terracota">
        Versão {versao} · novidades e roadmap
      </Link>
    </div>
  );
}

export function Navegacao({ grupos, nome, papel, sair, versao }: { grupos: GrupoNav[]; nome: string; papel: string; sair: () => Promise<void>; versao: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] flex-none flex-col border-r border-borda bg-lateral lg:flex">
        <div className="border-b border-trilho px-[18px] pt-[18px] pb-3.5">
          <Marca />
        </div>
        <Lista grupos={grupos} />
        <Rodape nome={nome} papel={papel} sair={sair} versao={versao} />
      </aside>

      {/* Celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-borda bg-lateral px-4 py-2.5 lg:hidden">
        <Marca />
        <Dialog.Root open={aberto} onOpenChange={setAberto}>
          <Dialog.Trigger className="grid size-11 cursor-pointer place-items-center rounded-lg border border-borda-campo bg-superficie" aria-label="Abrir menu">
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-tinta/35" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-lateral focus:outline-none" aria-describedby={undefined}>
              <div className="flex items-center justify-between border-b border-trilho px-4 py-3">
                <Dialog.Title className="font-display text-lg">Menu</Dialog.Title>
                <Dialog.Close className="grid size-10 cursor-pointer place-items-center rounded-lg border border-borda-campo bg-superficie" aria-label="Fechar menu">
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <Lista grupos={grupos} aoNavegar={() => setAberto(false)} />
              <Rodape nome={nome} papel={papel} sair={sair} versao={versao} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>
    </>
  );
}
