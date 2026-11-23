import { Info } from "lucide-react";

import { type GrupoNav, Navegacao } from "@/components/shell/navegacao";
import { exigirPapel } from "@/lib/auth";
import { carregarSemana, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { VERSAO } from "@/lib/versao";

import { sair } from "../login/acoes";

async function gruposGestora(): Promise<GrupoNav[]> {
  const supabase = await criarClienteServidor();
  const [semana, { count: solicitacoes }] = await Promise.all([
    semanaPadrao(supabase).then((s) => carregarSemana(supabase, s)),
    supabase.from("solicitacoes_correcao").select("id", { count: "exact", head: true }).eq("status", "pendente"),
  ]);
  const pendencias =
    semana.funcionarias.reduce((n, f) => n + f.resultado.bloqueios + f.resultado.avisos, 0) + semana.idsDesconhecidos.length;

  return [
    { itens: [{ href: "/inicio", rotulo: "Início" }] },
    {
      rotulo: "PONTO E RH",
      itens: [
        { href: "/ponto/semana", rotulo: "Semana" },
        { href: "/ponto/pendencias", rotulo: "Pendências", contador: { n: pendencias, tom: "perigo" } },
        { href: "/ponto/solicitacoes", rotulo: "Solicitações", contador: { n: solicitacoes ?? 0, tom: "info" } },
        { href: "/ponto/importar", rotulo: "Importar arquivo" },
        { href: "/ponto/banco", rotulo: "Banco de horas" },
        { href: "/ponto/fechamento", rotulo: "Fechamento" },
        { href: "/ponto/equipe", rotulo: "Equipe" },
        { href: "/ponto/calendario", rotulo: "Calendário e regras" },
      ],
    },
    {
      rotulo: "VENDAS",
      itens: [
        { href: "/orcamentos", rotulo: "Orçamentos" },
        { href: "/clientes", rotulo: "Clientes" },
        { href: "/catalogo", rotulo: "Catálogo e preços" },
      ],
    },
    { rotulo: "FINANCEIRO", itens: [{ href: "/recibos", rotulo: "Recibos" }] },
    { itens: [{ href: "/configuracoes", rotulo: "Configurações" }, { href: "/ajuda", rotulo: "Como usar" }] },
  ];
}

const GRUPOS_CONTADOR: GrupoNav[] = [
  {
    rotulo: "RELATÓRIOS DE RH",
    itens: [
      { href: "/rh/semanas", rotulo: "Semanas e espelhos" },
      { href: "/rh/banco", rotulo: "Banco de horas" },
    ],
  },
  { rotulo: "FINANCEIRO", itens: [{ href: "/recibos", rotulo: "Recibos" }] },
  { itens: [{ href: "/ajuda", rotulo: "Como usar" }] },
];

export default async function LayoutGestao({ children }: { children: React.ReactNode }) {
  const sessao = await exigirPapel("gestora", "contador");
  const contador = sessao.papel === "contador";
  const grupos = contador ? GRUPOS_CONTADOR : await gruposGestora();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Navegacao grupos={grupos} nome={sessao.nome} papel={contador ? "Contador(a)" : "Gestora"} sair={sair} versao={VERSAO} />
      <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 pt-5 pb-12 lg:px-8 lg:pt-6">
        {contador ? (
          <div className="flex items-center gap-2.5 self-start rounded-[10px] bg-info-fundo px-3.5 py-2.5 text-sm text-info-texto">
            <Info className="size-4" />
            <b>Somente leitura</b>
            <span>· você pode ver e exportar, sem editar.</span>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
