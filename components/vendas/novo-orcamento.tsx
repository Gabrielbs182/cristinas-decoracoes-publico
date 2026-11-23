"use client";

import { Plus, Search, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { criarClienteEOrcamento, criarOrcamento } from "@/app/(gestao)/orcamentos/acoes";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { cn } from "@/lib/utils";

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Escolher o cliente (ou cadastrar só nome e telefone) e abrir o editor. */
export function NovoOrcamento({ clientes, clienteId }: { clientes: { id: string; nome: string; telefone: string; bairro: string }[]; clienteId?: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const abrirEditor = (acao: () => ReturnType<typeof criarOrcamento>) =>
    iniciar(async () => {
      const r = await acao();
      if (!r.ok || !r.id) {
        toast.error(r.ok ? "Não deu para criar o orçamento." : r.erro);
        return;
      }
      toast.success(r.mensagem);
      router.push(`/orcamentos/${r.id}`);
    });

  // Da ficha do cliente: já sabe quem é.
  if (clienteId) {
    return (
      <Botao disabled={enviando} onClick={() => abrirEditor(() => criarOrcamento({ clienteId }))}>
        <Plus /> Orçamento
      </Botao>
    );
  }

  const termo = normalizar(busca.trim());
  const digitos = busca.replace(/\D/g, "");
  const achados = clientes
    .filter((c) => !termo || normalizar(`${c.nome} ${c.bairro}`).includes(termo) || (digitos.length >= 3 && c.telefone.replace(/\D/g, "").includes(digitos)))
    .slice(0, 8);

  return (
    <>
      <Botao onClick={() => setAberto(true)}>
        <Plus /> Novo orçamento
      </Botao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo="Novo orçamento"
        descricao={novo ? "Só o essencial agora; o resto do cadastro você completa depois na ficha." : "Para quem é o orçamento?"}
        rodape={
          novo ? (
            <>
              <Botao variante="secundario" onClick={() => setNovo(false)}>
                Voltar
              </Botao>
              <Botao disabled={enviando || nome.trim().length < 2} onClick={() => abrirEditor(() => criarClienteEOrcamento({ nome, telefone }))}>
                Cadastrar e abrir o orçamento
              </Botao>
            </>
          ) : (
            <Botao variante="secundario" onClick={() => setNovo(true)}>
              <UserPlus /> Cliente novo
            </Botao>
          )
        }
      >
        {novo ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">Nome</span>
              <Campo value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} autoFocus />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">WhatsApp / telefone</span>
              <Campo value={telefone} onChange={(e) => setTelefone(e.target.value)} type="tel" inputMode="tel" placeholder="(19) 99999-9999" maxLength={30} />
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
              <Campo value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente por nome, telefone ou bairro" aria-label="Buscar cliente" className="pl-9" autoFocus />
            </div>
            <div className="flex max-h-72 flex-col overflow-y-auto rounded-lg border border-borda">
              {!achados.length ? <span className="px-3 py-3 text-sm text-tinta-3">Nenhum cliente encontrado. Use “Cliente novo”.</span> : null}
              {achados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={enviando}
                  onClick={() => abrirEditor(() => criarOrcamento({ clienteId: c.id }))}
                  className={cn("flex cursor-pointer flex-col items-start border-b border-trilho px-3 py-2.5 text-left last:border-b-0 hover:bg-suave disabled:opacity-50")}
                >
                  <b className="text-sm">{c.nome}</b>
                  <span className="text-xs text-tinta-3">{[c.telefone, c.bairro].filter(Boolean).join(" · ") || "—"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Dialogo>
    </>
  );
}
