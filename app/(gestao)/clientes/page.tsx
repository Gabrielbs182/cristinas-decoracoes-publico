import type { Metadata } from "next";

import { ListaClientes } from "@/components/vendas/lista-clientes";
import { PainelCliente } from "@/components/vendas/painel-cliente";
import { TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clientes" };

export default async function PaginaClientes() {
  await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("clientes").select("id, nome, telefone, residencia_bairro, residencia_cidade, obra_bairro").order("nome").limit(2000);
  const clientes = (data ?? []).map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone, bairro: c.residencia_bairro || c.obra_bairro, cidade: c.residencia_cidade }));

  return (
    <>
      <TituloPagina contexto="Vendas" titulo="Clientes">
        <PainelCliente />
      </TituloPagina>
      <ListaClientes clientes={clientes} />
    </>
  );
}
