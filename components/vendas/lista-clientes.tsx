"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Campo } from "@/components/ui/campos";
import { Sobretitulo } from "@/components/ui/cartao";

export interface ClienteDaLista {
  id: string;
  nome: string;
  telefone: string;
  bairro: string;
  cidade: string;
}

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Busca instantânea por nome, telefone ou bairro (ignora acento; telefone só pelos dígitos). */
export function ListaClientes({ clientes }: { clientes: ClienteDaLista[] }) {
  const [busca, setBusca] = useState("");
  const termo = normalizar(busca.trim());
  const digitos = busca.replace(/\D/g, "");
  const visiveis = termo
    ? clientes.filter(
        (c) => normalizar(`${c.nome} ${c.bairro} ${c.cidade}`).includes(termo) || (digitos.length >= 3 && c.telefone.replace(/\D/g, "").includes(digitos)),
      )
    : clientes;
  const colunas = "md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-4";

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
        <Campo value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone ou bairro" aria-label="Buscar cliente" className="h-11 pl-9 text-[15px]" />
      </div>
      <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
        <div className={`hidden border-b border-trilho bg-suave px-4 py-2.5 ${colunas}`}>
          {["Nome", "Telefone", "Bairro", "Cidade"].map((h) => (
            <Sobretitulo key={h}>{h}</Sobretitulo>
          ))}
        </div>
        {!visiveis.length ? (
          <div className="px-4 py-6 text-center text-sm text-tinta-3">{clientes.length ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</div>
        ) : null}
        {visiveis.map((c) => (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            className={`flex flex-col gap-0.5 border-b border-trilho px-4 py-3 text-sm text-tinta no-underline last:border-b-0 hover:bg-suave ${colunas} md:items-center`}
          >
            <b className="text-[15px]">{c.nome}</b>
            <span className="tabular-nums">{c.telefone || "—"}</span>
            <span className="text-tinta-2">{c.bairro || "—"}</span>
            <span className="text-tinta-2">{c.cidade || "—"}</span>
          </Link>
        ))}
      </div>
      {termo ? <span className="text-xs text-tinta-3">{visiveis.length} de {clientes.length} clientes</span> : null}
    </>
  );
}
