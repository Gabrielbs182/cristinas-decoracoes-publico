"use client";

import { useState } from "react";

import { salvarEmpresa } from "@/app/(gestao)/configuracoes/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";

export interface DadosEmpresa {
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  endereco: string;
  cidade_uf: string;
  telefone: string;
  email: string;
  chave_pix: string;
}

const CAMPOS: { campo: keyof DadosEmpresa; rotulo: string; largo?: boolean; tipo?: string }[] = [
  { campo: "nome_fantasia", rotulo: "Nome fantasia" },
  { campo: "razao_social", rotulo: "Razão social" },
  { campo: "cnpj", rotulo: "CNPJ" },
  { campo: "telefone", rotulo: "Telefone / WhatsApp", tipo: "tel" },
  { campo: "endereco", rotulo: "Endereço", largo: true },
  { campo: "cidade_uf", rotulo: "Cidade / UF" },
  { campo: "email", rotulo: "E-mail", tipo: "email" },
  { campo: "chave_pix", rotulo: "Chave PIX (para os recibos)", largo: true },
];

export function FormEmpresa({ atuais }: { atuais: DadosEmpresa }) {
  const { enviando, executar } = useAcao();
  const [d, setD] = useState(atuais);
  const mudou = CAMPOS.some(({ campo }) => d[campo] !== atuais[campo]);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => salvarEmpresa(d));
      }}
    >
      {CAMPOS.map(({ campo, rotulo, largo, tipo }) => (
        <label key={campo} className={largo ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
          <span className="text-[13px] font-bold">{rotulo}</span>
          <Campo type={tipo ?? "text"} value={d[campo]} onChange={(e) => setD((x) => ({ ...x, [campo]: e.target.value }))} />
        </label>
      ))}
      <div className="sm:col-span-2">
        <Botao type="submit" disabled={enviando || !mudou}>
          Salvar dados da empresa
        </Botao>
      </div>
    </form>
  );
}
