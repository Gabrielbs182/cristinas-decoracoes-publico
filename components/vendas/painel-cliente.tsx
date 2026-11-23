"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { type EntradaCliente, salvarCliente } from "@/app/(gestao)/clientes/acoes";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { PainelLateral } from "@/components/ui/painel-lateral";

export type ClienteEditavel = Omit<EntradaCliente, "obraNaResidencia"> & { id: string };

const VAZIO: Omit<EntradaCliente, "obraNaResidencia"> = {
  nome: "",
  telefone: "",
  email: "",
  documento: "",
  residenciaEndereco: "",
  residenciaBairro: "",
  residenciaCidade: "",
  obraEndereco: "",
  obraBairro: "",
  obraCidade: "",
  observacoes: "",
};

function Rotulo({ titulo, largo, children }: { titulo: string; largo?: boolean; children: React.ReactNode }) {
  return (
    <label className={largo ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
      <span className="text-[13px] font-bold">{titulo}</span>
      {children}
    </label>
  );
}

/** Cadastro e edição. Novo cliente abre a ficha dele ao salvar. */
export function PainelCliente({ cliente }: { cliente?: ClienteEditavel }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [c, setC] = useState(VAZIO);
  const [obraNaResidencia, setObraNaResidencia] = useState(true);
  const campo = (k: keyof typeof VAZIO) => ({
    value: c[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC((x) => ({ ...x, [k]: e.target.value })),
  });

  const abrir = () => {
    const inicial = cliente ? { ...VAZIO, ...cliente } : VAZIO;
    setC(inicial);
    setObraNaResidencia(!inicial.obraEndereco);
    setAberto(true);
  };
  const salvar = () =>
    iniciar(async () => {
      const r = await salvarCliente({ ...c, id: cliente?.id, obraNaResidencia });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setAberto(false);
      if (!cliente && r.id) router.push(`/clientes/${r.id}`);
    });

  return (
    <>
      {cliente ? (
        <Botao variante="secundario" onClick={abrir}>
          <Pencil /> Editar
        </Botao>
      ) : (
        <Botao onClick={abrir}>
          <Plus /> Cliente
        </Botao>
      )}
      <PainelLateral aberto={aberto} aoFechar={() => setAberto(false)} subtitulo="Clientes" titulo={cliente ? cliente.nome : "Novo cliente"}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-extrabold">Contato</legend>
            <Rotulo titulo="Nome" largo>
              <Campo {...campo("nome")} maxLength={120} autoFocus />
            </Rotulo>
            <Rotulo titulo="WhatsApp / telefone">
              <Campo {...campo("telefone")} type="tel" inputMode="tel" placeholder="(19) 99999-9999" maxLength={30} />
            </Rotulo>
            <Rotulo titulo="E-mail">
              <Campo {...campo("email")} type="email" maxLength={120} />
            </Rotulo>
            <Rotulo titulo="CPF ou CNPJ (opcional)">
              <Campo {...campo("documento")} inputMode="numeric" maxLength={18} />
            </Rotulo>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-extrabold">Residência</legend>
            <Rotulo titulo="Endereço" largo>
              <Campo {...campo("residenciaEndereco")} placeholder="Rua, número, complemento" maxLength={200} />
            </Rotulo>
            <Rotulo titulo="Bairro">
              <Campo {...campo("residenciaBairro")} maxLength={80} />
            </Rotulo>
            <Rotulo titulo="Cidade / UF">
              <Campo {...campo("residenciaCidade")} placeholder="Campinas/SP" maxLength={80} />
            </Rotulo>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-extrabold">Obra</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={obraNaResidencia} onChange={(e) => setObraNaResidencia(e.target.checked)} className="size-4 accent-terracota" />A obra é na residência
            </label>
            {!obraNaResidencia ? (
              <>
                <Rotulo titulo="Endereço da obra" largo>
                  <Campo {...campo("obraEndereco")} maxLength={200} />
                </Rotulo>
                <Rotulo titulo="Bairro">
                  <Campo {...campo("obraBairro")} maxLength={80} />
                </Rotulo>
                <Rotulo titulo="Cidade / UF">
                  <Campo {...campo("obraCidade")} maxLength={80} />
                </Rotulo>
              </>
            ) : null}
          </fieldset>

          <Rotulo titulo="Observações">
            <AreaTexto {...campo("observacoes")} maxLength={1000} placeholder="Como conheceu a loja, preferências, horários para visita…" />
          </Rotulo>

          <Botao type="submit" disabled={enviando || c.nome.trim().length < 2} className="self-start">
            {cliente ? "Salvar" : "Cadastrar cliente"}
          </Botao>
        </form>
      </PainelLateral>
    </>
  );
}
