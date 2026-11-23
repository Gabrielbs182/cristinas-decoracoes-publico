import type { Metadata } from "next";

import { AcoesDeAcesso, CriarAcessoFuncionaria, ProvedorLinks, SeloAcesso } from "@/components/equipe/acesso";
import { type FuncionariaEditavel, PainelFuncionaria } from "@/components/equipe/painel-funcionaria";
import { Cartao, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { usuariosDoAuth } from "@/lib/acessos";
import { exigirPapel } from "@/lib/auth";
import { situacaoDoAcesso, sugerirLogin } from "@/lib/equipe";
import { hhmm } from "@/lib/ponto";
import { regrasVigentes, semanaPadrao } from "@/lib/ponto/servidor";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Equipe" };

export default async function PaginaEquipe() {
  await exigirPapel("gestora");
  const supabase = await criarClienteServidor();
  const [{ data: funcionarias }, { data: perfis }, usuarios, regras] = await Promise.all([
    supabase.from("funcionarias").select("id, nome, nome_exibicao, en_no, ativa, carga_seg_qui_min, carga_sex_min").order("nome_exibicao"),
    supabase.from("perfis").select("id, funcionaria_id, ativo").eq("papel", "funcionaria"),
    usuariosDoAuth(),
    semanaPadrao(supabase).then((s) => regrasVigentes(supabase, s)),
  ]);
  const regraGeral = `Seg–Qui ${hhmm(regras.cargaSegQuiMin)} · Sex ${hhmm(regras.cargaSexMin)}`;
  const linhas = (funcionarias ?? []).map((f) => {
    const perfil = (perfis ?? []).find((p) => p.funcionaria_id === f.id) ?? null;
    const usuario = perfil ? (usuarios.get(perfil.id) ?? null) : null;
    const editavel: FuncionariaEditavel = {
      id: f.id,
      nome: f.nome,
      nomeExibicao: f.nome_exibicao,
      enNo: f.en_no,
      cargaSegQui: f.carga_seg_qui_min != null ? hhmm(f.carga_seg_qui_min) : "",
      cargaSex: f.carga_sex_min != null ? hhmm(f.carga_sex_min) : "",
      ativa: f.ativa,
      nomeDela: !!perfil?.ativo,
    };
    const propria = f.carga_seg_qui_min != null || f.carga_sex_min != null;
    const jornada = propria
      ? `Seg–Qui ${hhmm(f.carga_seg_qui_min ?? regras.cargaSegQuiMin)} · Sex ${hhmm(f.carga_sex_min ?? regras.cargaSexMin)}`
      : regraGeral;
    return { f, perfil, usuario, editavel, jornada, propria, situacao: situacaoDoAcesso(perfil, usuario) };
  });
  const ativas = linhas.filter((l) => l.f.ativa);
  const desligadas = linhas.filter((l) => !l.f.ativa);

  const Linha = ({ l }: { l: (typeof linhas)[number] }) => (
    <div className="grid gap-x-4 gap-y-2.5 border-b border-trilho px-4 py-3.5 last:border-b-0 xl:grid-cols-[minmax(0,1.3fr)_90px_150px_minmax(0,1fr)_360px] xl:items-center">
      <div className="flex min-w-0 flex-col">
        <b className="text-[15px]">{l.f.nome_exibicao}</b>
        <span className="truncate text-[13px] text-tinta-3">{l.f.nome}</span>
      </div>
      <div className="text-sm">
        <span className="text-xs font-semibold text-tinta-3 xl:hidden">ID da catraca </span>
        {l.f.en_no ? <span className="font-semibold tabular-nums">{l.f.en_no.replace(/^0+(?=\d)/, "")}</span> : <span className="text-perigo">sem ID</span>}
      </div>
      <div className="flex flex-col text-sm">
        {l.jornada.split(" · ").map((parte) => (
          <span key={parte} className="whitespace-nowrap">
            {parte}
          </span>
        ))}
        {l.propria ? <span className="text-xs text-tinta-3">jornada própria</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 xl:flex-col xl:items-start xl:gap-1">
        <SeloAcesso situacao={l.situacao} className="self-center xl:self-start" />
        {l.usuario ? <span className="text-[13px] font-semibold">{l.usuario.login}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
        <PainelFuncionaria funcionaria={l.editavel} regraGeral={regraGeral} />
        {!l.f.ativa ? null : l.perfil ? (
          <AcoesDeAcesso userId={l.perfil.id} situacao={l.situacao} />
        ) : (
          <CriarAcessoFuncionaria funcionariaId={l.f.id} nome={l.f.nome_exibicao} sugestao={sugerirLogin(l.f.nome_exibicao)} />
        )}
      </div>
    </div>
  );

  return (
    <ProvedorLinks>
      <TituloPagina contexto="Ponto e RH" titulo="Equipe">
        <PainelFuncionaria regraGeral={regraGeral} />
      </TituloPagina>

      <Cartao className="overflow-hidden">
        <div className="hidden border-b border-trilho bg-suave px-4 py-2.5 xl:grid xl:grid-cols-[minmax(0,1.3fr)_90px_150px_minmax(0,1fr)_360px] xl:gap-x-4">
          {["Funcionária", "ID catraca", "Jornada", "Acesso", ""].map((h) => (
            <Sobretitulo key={h}>{h}</Sobretitulo>
          ))}
        </div>
        {ativas.length ? ativas.map((l) => <Linha key={l.f.id} l={l} />) : <div className="px-4 py-3.5 text-sm text-tinta-3">Nenhuma funcionária ativa.</div>}
      </Cartao>
      <div className="text-[13px] text-pretty text-tinta-3">
        Sem e-mail, a funcionária entra com um usuário curto que você cria (ex.: ana.s). O link para ela criar a senha vai pelo WhatsApp, vale por 24 horas e
        funciona uma vez só. Depois de entrar, é ela quem escolhe como o nome aparece.
      </div>

      {desligadas.length ? (
        <details className="rounded-xl border border-borda bg-superficie">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3.5 text-sm font-bold">
            Desligadas ({desligadas.length})
            <Selo tom="neutro" icone="circulo">
              fora do ponto
            </Selo>
          </summary>
          {desligadas.map((l) => (
            <Linha key={l.f.id} l={l} />
          ))}
        </details>
      ) : null}
    </ProvedorLinks>
  );
}
