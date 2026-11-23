import { FileDown, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { AprovarPeloLink } from "@/components/vendas/aprovar-link";
import { dataBrIso, dataSP, type DocumentoOrcamento } from "@/lib/vendas/documento";
import { brl, whatsappDoTelefone } from "@/lib/vendas/numeros";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orçamento", robots: { index: false, follow: false } };

const n4 = (n: number) => String(n).padStart(4, "0");

/**
 * Página da cliente (sem login). Abrir não muda nada — a prévia do WhatsApp também abre; aprovar é um
 * clique com confirmação. Só aparece orçamento já enviado.
 */
export default async function OrcamentoDaCliente({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await criarClienteServidor();
  const { data } = /^[0-9a-f-]{36}$/i.test(token) ? await supabase.rpc("orcamento_publico", { p_token: token }) : { data: null };
  const d = data as unknown as DocumentoOrcamento | null;

  // 30 dias depois de vencer o link expira (o banco devolve só a data, nada da cliente).
  if (d && "expirado" in d) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 bg-fundo px-6 text-center">
        <Image src="/logo-circulo.png" alt="" width={96} height={96} className="size-24" />
        <h1 className="font-display text-[26px]">Este link expirou</h1>
        <p className="text-sm text-pretty text-tinta-3">Fale com a loja para receber um orçamento atualizado.</p>
      </main>
    );
  }

  if (!d) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 bg-fundo px-6 text-center">
        <Image src="/logo-circulo.png" alt="" width={96} height={96} className="size-24" />
        <h1 className="font-display text-[26px]">Orçamento não encontrado</h1>
        <p className="text-sm text-pretty text-tinta-3">Confira se o link está completo ou peça um novo à loja.</p>
      </main>
    );
  }

  const empresa = d.empresa?.nome || "Cristina's Decorações";
  const whatsLoja = d.empresa?.telefone ? whatsappDoTelefone(d.empresa.telefone) : null;
  const primeiroNome = d.cliente.nome.split(" ")[0];
  const aberto = d.status === "enviado" && !d.vencido;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 bg-fundo px-4 pt-6 pb-10">
      <header className="flex items-center gap-3">
        <Image src="/logo-circulo.png" alt="" width={56} height={56} className="size-14 rounded-full" />
        <div className="flex flex-col">
          <span className="font-display text-xl">{empresa}</span>
          <span className="text-xs text-tinta-3">Cortinas e persianas sob medida</span>
        </div>
      </header>

      <section className="flex flex-col gap-1 rounded-2xl border border-borda bg-superficie p-5">
        <span className="text-xs font-bold tracking-[.06em] text-terracota uppercase">Orçamento nº {n4(d.numero)}</span>
        <h1 className="font-display text-[26px] leading-tight">Olá, {primeiroNome}!</h1>
        <span className="text-sm text-tinta-2">{d.endereco_obra ? `Obra: ${d.endereco_obra}` : "Seu orçamento de cortinas e persianas."}</span>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-trilho pt-3">
          <span className="text-sm font-bold">Total</span>
          <b className="font-display text-[30px]">{brl(d.total_centavos)}</b>
        </div>
        {d.condicoes_pagamento ? <span className="text-right text-xs text-tinta-3">{d.condicoes_pagamento}</span> : null}
      </section>

      {d.status === "aprovado" ? (
        <div role="status" className="rounded-xl bg-sucesso-fundo px-4 py-3 text-sm font-bold text-sucesso">
          Aprovado em {d.respondido_em ? dataSP(d.respondido_em) : ""}. A loja vai entrar em contato para combinar o sinal e a instalação.
        </div>
      ) : d.vencido ? (
        <div role="status" className="rounded-xl bg-perigo-fundo px-4 py-3 text-sm font-bold text-perigo">
          Este orçamento venceu em {d.valido_ate ? dataBrIso(d.valido_ate) : ""}. Fale com a loja para renovar.
        </div>
      ) : d.status === "recusado" ? (
        <div role="status" className="rounded-xl bg-suave px-4 py-3 text-sm font-bold text-tinta-2">
          Este orçamento foi encerrado. Fale com a loja se quiser retomar.
        </div>
      ) : (
        <div className="rounded-xl bg-suave px-4 py-3 text-sm text-tinta-2">Válido até {d.valido_ate ? dataBrIso(d.valido_ate) : "—"}.</div>
      )}

      {d.ambientes
        .filter((a) => a.itens.length)
        .map((a) => (
          <section key={a.nome} className="overflow-hidden rounded-2xl border border-borda bg-superficie">
            <div className="flex items-baseline justify-between gap-3 border-b border-trilho px-4 py-3">
              <h2 className="font-display text-lg">{a.nome}</h2>
              <b className="text-sm tabular-nums">{brl(a.itens.reduce((t, i) => t + i.total_centavos, 0))}</b>
            </div>
            {a.itens.map((i, k) => (
              <div key={k} className="flex items-start justify-between gap-3 border-b border-trilho px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-pretty">{i.descricao}</span>
                  <span className="text-xs text-tinta-3">
                    {[i.medidas, i.quantidade > 1 ? `${i.quantidade} × ${brl(i.unitario_centavos)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <b className="text-sm whitespace-nowrap tabular-nums">{brl(i.total_centavos)}</b>
              </div>
            ))}
          </section>
        ))}

      <section className="flex flex-col gap-1.5 rounded-2xl border border-borda bg-superficie p-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{brl(d.subtotal_centavos)}</span>
        </div>
        {d.desconto_centavos ? (
          <div className="flex justify-between text-sucesso">
            <span>Desconto</span>
            <span className="tabular-nums">− {brl(d.desconto_centavos)}</span>
          </div>
        ) : null}
        {d.deslocamento_centavos ? (
          <div className="flex justify-between">
            <span>Taxa de deslocamento</span>
            <span className="tabular-nums">{brl(d.deslocamento_centavos)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-trilho pt-2 font-bold">
          <span>Total</span>
          <span className="tabular-nums">{brl(d.total_centavos)}</span>
        </div>
        {d.prazo_entrega ? <p className="pt-2 text-tinta-2">Prazo de entrega: {d.prazo_entrega}.</p> : null}
        {d.obs_cliente ? <p className="text-pretty whitespace-pre-line text-tinta-2">{d.obs_cliente}</p> : null}
      </section>

      <div className="flex flex-col gap-2.5">
        {aberto ? <AprovarPeloLink token={token} numero={n4(d.numero)} total={brl(d.total_centavos)} /> : null}
        <a
          href={`/o/${token}/pdf`}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-borda-campo bg-superficie text-[15px] font-bold text-tinta no-underline"
        >
          <FileDown className="size-5" /> Baixar em PDF
        </a>
        {whatsLoja ? (
          <a
            href={whatsLoja}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-borda-campo bg-superficie text-[15px] font-bold text-tinta no-underline"
          >
            <MessageCircle className="size-5" /> Falar com a loja
          </a>
        ) : null}
      </div>
    </main>
  );
}
