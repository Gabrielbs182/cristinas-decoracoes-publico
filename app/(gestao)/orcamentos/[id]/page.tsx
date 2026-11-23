import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EditorOrcamento } from "@/components/vendas/editor/editor-orcamento";
import { exigirPapel } from "@/lib/auth";
import { enderecoDoSistema } from "@/lib/endereco-publico";
import { carregarCatalogo, carregarOrcamento, enderecosDoCliente } from "@/lib/vendas/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orçamento" };

export default async function PaginaOrcamento({ params }: { params: Promise<{ id: string }> }) {
  await exigirPapel("gestora");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteServidor();
  const [orcamento, catalogo, { data: clientes }, base] = await Promise.all([
    carregarOrcamento(supabase, id),
    carregarCatalogo(supabase),
    supabase.from("clientes").select("id, nome, telefone, residencia_endereco, residencia_bairro, residencia_cidade, obra_endereco, obra_bairro, obra_cidade").order("nome").limit(2000),
    enderecoDoSistema(),
  ]);
  if (!orcamento) notFound();
  // Recebimentos (só de orçamento aprovado; cancelados aparecem riscados).
  const [{ data: saldo }, { data: recibos }] =
    orcamento.status === "aprovado"
      ? await Promise.all([
          supabase.from("saldos_orcamentos").select("total_centavos, pago_centavos, saldo_centavos").eq("orcamento_id", id).maybeSingle(),
          supabase.from("recibos").select("id, numero, tipo, valor_centavos, data_pagamento, status").eq("orcamento_id", id).order("numero"),
        ])
      : [{ data: null }, { data: null }];

  return (
    <EditorOrcamento
      // Só o id: mudar a situação não pode remontar o editor (apagaria o diálogo de envio aberto).
      key={orcamento.id}
      orcamento={orcamento}
      catalogo={catalogo}
      linkCliente={`${base}/o/${orcamento.token}`}
      pagamentos={
        saldo
          ? {
              totalCentavos: saldo.total_centavos!,
              pagoCentavos: saldo.pago_centavos!,
              saldoCentavos: saldo.saldo_centavos!,
              recibos: (recibos ?? []).map((r) => ({ id: r.id, numero: r.numero, tipo: r.tipo, valorCentavos: r.valor_centavos, dataPagamento: r.data_pagamento, status: r.status })),
            }
          : null
      }
      clientes={(clientes ?? []).map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone, enderecos: enderecosDoCliente(c) }))}
    />
  );
}
