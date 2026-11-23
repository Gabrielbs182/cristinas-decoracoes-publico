import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AcoesDeAcesso, ConvidarUsuario, ProvedorLinks, SeloAcesso } from "@/components/equipe/acesso";
import { FormEmpresa } from "@/components/equipe/form-empresa";
import { PadroesOrcamento } from "@/components/vendas/padroes-orcamento";
import { Cartao, CabecalhoCartao, TituloPagina } from "@/components/ui/cartao";
import { usuariosDoAuth } from "@/lib/acessos";
import { exigirPapel } from "@/lib/auth";
import { situacaoDoAcesso } from "@/lib/equipe";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configurações" };

const PAPEL = { gestora: "Gestora", contador: "Contador(a)", funcionaria: "Funcionária" } as const;
const ORDEM = { gestora: 0, contador: 1, funcionaria: 2 } as const;

export default async function PaginaConfiguracoes() {
  const sessao = await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const [{ data: empresa }, { data: perfis }, usuarios, { data: regras }, { data: numeracao }, { data: ultimo }, { data: ultimoRecibo }] = await Promise.all([
    supabase.from("empresa").select("*").maybeSingle(),
    supabase.from("perfis").select("id, nome, papel, ativo"),
    usuariosDoAuth(),
    supabase.from("regras_orcamento").select("validade_padrao_dias, prazo_entrega_padrao, condicoes_padrao").maybeSingle(),
    supabase.from("numeracao").select("tipo, proximo"),
    supabase.from("orcamentos").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("recibos").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const lista = (perfis ?? [])
    .map((p) => ({ ...p, usuario: usuarios.get(p.id) ?? null }))
    .sort((a, b) => ORDEM[a.papel] - ORDEM[b.papel] || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <ProvedorLinks>
      <TituloPagina contexto="Gestora" titulo="Configurações" />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Cartao className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-4">
            <Image src="/logo-circulo.png" alt="Logo" width={64} height={64} className="size-16 rounded-full" />
            <div className="flex flex-col">
              <b className="text-[15px]">Dados da empresa</b>
              <span className="text-[13px] text-tinta-3">Vão no cabeçalho dos espelhos de ponto e, depois, dos orçamentos e recibos.</span>
            </div>
          </div>
          <FormEmpresa
            atuais={{
              nome_fantasia: empresa?.nome_fantasia ?? "",
              razao_social: empresa?.razao_social ?? "",
              cnpj: empresa?.cnpj ?? "",
              endereco: empresa?.endereco ?? "",
              cidade_uf: empresa?.cidade_uf ?? "",
              telefone: empresa?.telefone ?? "",
              email: empresa?.email ?? "",
              chave_pix: empresa?.chave_pix ?? "",
            }}
          />
        </Cartao>

        <Cartao className="overflow-hidden">
          <CabecalhoCartao>
            <b className="text-[15px]">Usuários e perfis</b>
            <ConvidarUsuario />
          </CabecalhoCartao>
          {lista.map((p) => {
            const situacao = situacaoDoAcesso(p, p.usuario);
            return (
              <div key={p.id} className="flex flex-col gap-2 border-b border-trilho px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <b className="text-sm">{p.nome}</b>
                  <span className="text-[13px] text-tinta-3">{p.usuario?.login ?? "—"}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-xs font-semibold text-tinta-3">{PAPEL[p.papel]}</span>
                    <SeloAcesso situacao={situacao} className="self-center" />
                  </span>
                </div>
                {p.papel === "funcionaria" ? (
                  <Link href="/ponto/equipe" className="self-start text-[13px] font-bold">
                    Gerenciar na Equipe
                  </Link>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <AcoesDeAcesso userId={p.id} situacao={situacao} ehVoce={p.id === sessao.userId} />
                  </div>
                )}
              </div>
            );
          })}
        </Cartao>

        <Cartao className="flex flex-col gap-4 p-5 xl:col-span-2">
          <div className="flex flex-col">
            <b className="text-[15px]">Orçamentos e recibos</b>
            <span className="text-[13px] text-tinta-3">Numeração sem buraco (o número cancelado não volta) e o que vem preenchido em todo orçamento novo.</span>
          </div>
          <PadroesOrcamento
            ultimo={ultimo?.numero ?? null}
            ultimoRecibo={ultimoRecibo?.numero ?? null}
            atuais={{
              proximoNumero: String(numeracao?.find((n) => n.tipo === "orcamento")?.proximo ?? 1),
              proximoRecibo: String(numeracao?.find((n) => n.tipo === "recibo")?.proximo ?? 1),
              validadeDias: String(regras?.validade_padrao_dias ?? 30),
              prazoEntrega: regras?.prazo_entrega_padrao ?? "",
              condicoes: regras?.condicoes_padrao ?? "",
            }}
          />
        </Cartao>
      </div>
    </ProvedorLinks>
  );
}
