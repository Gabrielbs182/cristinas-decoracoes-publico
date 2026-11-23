import { ChevronLeft, FileText, MessageCircle, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExcluirCliente } from "@/components/vendas/excluir-cliente";
import { NovoOrcamento } from "@/components/vendas/novo-orcamento";
import { PainelCliente } from "@/components/vendas/painel-cliente";
import { Cartao, CabecalhoCartao, EstadoVazio } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { brl, documentoFormatado, whatsappDoTelefone } from "@/lib/vendas/numeros";
import { numeroOrcamento, ROTULO_SITUACAO, situacaoDoOrcamento } from "@/lib/vendas/orcamento";
import { numeroRecibo, ROTULO_TIPO } from "@/lib/vendas/recibos";
import { hojeSP } from "@/lib/vendas/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cliente" };

const endereco = (rua: string, bairro: string, cidade: string) => [rua, [bairro, cidade].filter(Boolean).join(", ")].filter(Boolean).join(" — ");

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-trilho py-2.5 first:border-t-0">
      <span className="text-xs font-bold tracking-[.04em] text-tinta-3 uppercase">{rotulo}</span>
      <span className="text-sm text-pretty">{children}</span>
    </div>
  );
}

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirPapel("gestora");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteServidor();
  const [{ data: c }, { data: recibos }, { data: saldos }, { data: orcamentos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase.from("recibos").select("id, numero, tipo, valor_centavos, data_pagamento, status").eq("cliente_id", id).order("numero", { ascending: false }),
    supabase.from("saldos_orcamentos").select("saldo_centavos").eq("cliente_id", id),
    supabase.from("orcamentos").select("id, numero, status, valido_ate, total_centavos, criado_em").eq("cliente_id", id).order("numero", { ascending: false }),
  ]);
  if (!c) notFound();
  const hoje = hojeSP();
  const totalPago = (recibos ?? []).filter((r) => r.status === "emitido").reduce((t, r) => t + r.valor_centavos, 0);
  const emAberto = (saldos ?? []).reduce((t, x) => t + (x.saldo_centavos ?? 0), 0);

  const whats = whatsappDoTelefone(c.telefone);
  const residencia = endereco(c.residencia_endereco, c.residencia_bairro, c.residencia_cidade);
  const obra = c.obra_endereco ? endereco(c.obra_endereco, c.obra_bairro, c.obra_cidade) : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/clientes" className="flex items-center gap-1 self-start text-sm font-bold">
          <ChevronLeft className="size-4" /> Clientes
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-[30px] leading-tight font-medium">{c.nome}</h1>
          <div className="flex flex-wrap gap-2">
            <PainelCliente
              cliente={{
                id: c.id,
                nome: c.nome,
                telefone: c.telefone,
                email: c.email,
                documento: c.documento,
                residenciaEndereco: c.residencia_endereco,
                residenciaBairro: c.residencia_bairro,
                residenciaCidade: c.residencia_cidade,
                obraEndereco: c.obra_endereco,
                obraBairro: c.obra_bairro,
                obraCidade: c.obra_cidade,
                observacoes: c.observacoes,
              }}
            />
            <ExcluirCliente id={c.id} nome={c.nome} />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-4">
          <Cartao className="px-4 py-2">
            <Linha rotulo="WhatsApp / telefone">
              {c.telefone ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <b className="tabular-nums">{c.telefone}</b>
                  {whats ? (
                    <a href={whats} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold">
                      <MessageCircle className="size-4" /> Abrir conversa
                    </a>
                  ) : null}
                </span>
              ) : (
                "—"
              )}
            </Linha>
            <Linha rotulo="E-mail">{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</Linha>
            <Linha rotulo={c.documento.length === 14 ? "CNPJ" : "CPF"}>{c.documento ? documentoFormatado(c.documento) : "—"}</Linha>
          </Cartao>
          <Cartao className="px-4 py-2">
            <Linha rotulo="Residência">{residencia || "—"}</Linha>
            <Linha rotulo="Obra">{obra ?? (residencia ? "Na residência" : "—")}</Linha>
          </Cartao>
          {c.observacoes ? (
            <Cartao className="px-4 py-2">
              <Linha rotulo="Observações">{c.observacoes}</Linha>
            </Cartao>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Cartao className="overflow-hidden">
            <CabecalhoCartao>
              <b className="text-[15px]">Orçamentos</b>
              <NovoOrcamento clientes={[]} clienteId={c.id} />
            </CabecalhoCartao>
            {orcamentos?.length ? (
              orcamentos.map((o) => {
                const s = situacaoDoOrcamento(o.status, o.valido_ate, hoje);
                return (
                  <Link
                    key={o.id}
                    href={`/orcamentos/${o.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-trilho px-4 py-3 text-sm text-tinta no-underline last:border-b-0 hover:bg-suave"
                  >
                    <b className="tabular-nums">{numeroOrcamento(o.numero)}</b>
                    <span className="text-tinta-3">{new Date(o.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                    <b className="ml-auto tabular-nums">{brl(o.total_centavos)}</b>
                    <span className="w-24 text-right text-[13px] font-bold">{ROTULO_SITUACAO[s]}</span>
                  </Link>
                );
              })
            ) : (
              <div className="p-4">
                <EstadoVazio icone={<FileText />} titulo="Nenhum orçamento ainda">
                  Use “+ Orçamento” para montar o primeiro, já com este cliente.
                </EstadoVazio>
              </div>
            )}
          </Cartao>
          <Cartao className="overflow-hidden">
            <CabecalhoCartao>
              <b className="text-[15px]">Recibos</b>
              <span className="flex gap-4 text-[13px]">
                <span>
                  Pago <b className="text-sucesso tabular-nums">{brl(totalPago)}</b>
                </span>
                <span>
                  Em aberto <b className="tabular-nums">{brl(emAberto)}</b>
                </span>
              </span>
            </CabecalhoCartao>
            {recibos?.length ? (
              recibos.map((r) => (
                <Link
                  key={r.id}
                  href={`/recibos/${r.id}`}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-trilho px-4 py-3 text-sm no-underline last:border-b-0 hover:bg-suave ${r.status === "cancelado" ? "text-tinta-3 line-through" : "text-tinta"}`}
                >
                  <b className="tabular-nums">{numeroRecibo(r.numero)}</b>
                  <span className="text-tinta-3">{r.data_pagamento.split("-").reverse().join("/")}</span>
                  <span>{ROTULO_TIPO[r.tipo]}</span>
                  <b className="ml-auto tabular-nums">{brl(r.valor_centavos)}</b>
                </Link>
              ))
            ) : (
              <div className="p-4">
                <EstadoVazio icone={<Receipt />} titulo="Nenhum recibo ainda">
                  Os recibos aparecem aqui quando um orçamento deste cliente for aprovado e pago.
                </EstadoVazio>
              </div>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
