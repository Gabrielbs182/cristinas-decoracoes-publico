"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { definirFuncionariaAtiva, salvarFuncionaria } from "@/app/(gestao)/ponto/equipe/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { PainelLateral } from "@/components/ui/painel-lateral";
import { Rotulado } from "@/components/ui/rotulado";

export interface FuncionariaEditavel {
  id: string;
  nome: string;
  nomeExibicao: string;
  enNo: string | null;
  cargaSegQui: string; // "HH:MM" ou "" (regra geral)
  cargaSex: string;
  ativa: boolean;
  /** Tem acesso ativo: o nome de exibição é dela. */
  nomeDela: boolean;
}

const mascaraHora = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};
const HORA_OK = /^([01]\d|2[0-3]):[0-5]\d$/;

export function PainelFuncionaria({ funcionaria, regraGeral }: { funcionaria?: FuncionariaEditavel; regraGeral: string }) {
  const { enviando, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  const [confirmarDesligar, setConfirmarDesligar] = useState(false);
  const inicial = {
    nome: funcionaria?.nome ?? "",
    nomeExibicao: funcionaria?.nomeExibicao ?? "",
    enNo: funcionaria?.enNo ?? "",
    cargaSegQui: funcionaria?.cargaSegQui ?? "",
    cargaSex: funcionaria?.cargaSex ?? "",
  };
  const [f, setF] = useState(inicial);
  const [propria, setPropria] = useState(!!(inicial.cargaSegQui || inicial.cargaSex));
  const mudar = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [campo]: e.target.value }));

  const jornadaOk = !propria || (HORA_OK.test(f.cargaSegQui) && HORA_OK.test(f.cargaSex));
  const pronto = f.nome.trim().length >= 2 && f.nomeExibicao.trim().length >= 2 && jornadaOk;

  const abrir = () => {
    setF(inicial);
    setPropria(!!(inicial.cargaSegQui || inicial.cargaSex));
    setAberto(true);
  };
  const salvar = () =>
    executar(
      () =>
        salvarFuncionaria({
          id: funcionaria?.id,
          ...f,
          cargaSegQui: propria ? f.cargaSegQui : "",
          cargaSex: propria ? f.cargaSex : "",
        }),
      () => setAberto(false),
    );

  return (
    <>
      {funcionaria ? (
        <Botao variante="secundario" tamanho="p" onClick={abrir}>
          <Pencil /> Editar
        </Botao>
      ) : (
        <Botao onClick={abrir}>
          <Plus /> Nova funcionária
        </Botao>
      )}
      <PainelLateral
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        subtitulo="Equipe"
        titulo={funcionaria ? funcionaria.nomeExibicao : "Nova funcionária"}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pronto) salvar();
          }}
        >
          <Rotulado titulo="Nome completo" dica="Do cadastro. Não aparece nas telas do dia a dia.">
            <Campo value={f.nome} onChange={mudar("nome")} maxLength={80} autoFocus />
          </Rotulado>
          <Rotulado
            titulo="Como aparece no sistema"
            dica={funcionaria?.nomeDela ? "Ela tem acesso: o nome é escolhido por ela, no celular." : "Vai nas telas, no espelho e na planilha. Quando ela tiver acesso, ela mesma pode trocar."}
          >
            <Campo value={f.nomeExibicao} onChange={mudar("nomeExibicao")} maxLength={40} disabled={funcionaria?.nomeDela} />
          </Rotulado>
          <Rotulado
            titulo="ID da catraca"
            dica={
              funcionaria?.enNo
                ? "Já vinculado. As batidas chegam por este número."
                : "O número dela na catraca (EnNo). Se já chegaram batidas com ele, elas passam a ser dela."
            }
          >
            <Campo value={f.enNo} onChange={(e) => setF((x) => ({ ...x, enNo: e.target.value.replace(/\D/g, "").slice(0, 9) }))} inputMode="numeric" disabled={!!funcionaria?.enNo} />
          </Rotulado>

          <fieldset className="flex flex-col gap-2.5 rounded-xl border border-borda bg-superficie p-3.5">
            <legend className="px-1 text-sm font-bold">Jornada</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="jornada" checked={!propria} onChange={() => setPropria(false)} className="accent-terracota" />
              Regra geral <span className="text-tinta-3">({regraGeral})</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="jornada" checked={propria} onChange={() => setPropria(true)} className="accent-terracota" />
              Jornada própria
            </label>
            {propria ? (
              <div className="grid grid-cols-2 gap-2.5">
                <Rotulado titulo="Seg a qui, por dia">
                  <Campo value={f.cargaSegQui} onChange={(e) => setF((x) => ({ ...x, cargaSegQui: mascaraHora(e.target.value) }))} placeholder="HH:MM" inputMode="numeric" />
                </Rotulado>
                <Rotulado titulo="Sexta">
                  <Campo value={f.cargaSex} onChange={(e) => setF((x) => ({ ...x, cargaSex: mascaraHora(e.target.value) }))} placeholder="HH:MM" inputMode="numeric" />
                </Rotulado>
              </div>
            ) : null}
          </fieldset>

          <div className="flex flex-wrap items-center gap-2.5">
            <Botao type="submit" disabled={enviando || !pronto}>
              {funcionaria ? "Salvar" : "Cadastrar"}
            </Botao>
            {funcionaria ? (
              funcionaria.ativa ? (
                <Botao type="button" variante="perigo" onClick={() => setConfirmarDesligar(true)}>
                  Desligar
                </Botao>
              ) : (
                <Botao type="button" variante="secundario" disabled={enviando} onClick={() => executar(() => definirFuncionariaAtiva({ id: funcionaria.id, ativa: true }), () => setAberto(false))}>
                  Reativar
                </Botao>
              )
            ) : null}
          </div>
        </form>
      </PainelLateral>
      {funcionaria ? (
        <Dialogo
          aberto={confirmarDesligar}
          aoMudar={setConfirmarDesligar}
          titulo={`Desligar ${funcionaria.nomeExibicao}?`}
          descricao="Ela sai do ponto das próximas semanas e o acesso dela é bloqueado. As semanas em que ela trabalhou, o banco de horas e os espelhos continuam guardados."
          rodape={
            <>
              <Botao variante="secundario" onClick={() => setConfirmarDesligar(false)}>
                Cancelar
              </Botao>
              <Botao
                variante="perigo"
                disabled={enviando}
                onClick={() =>
                  executar(
                    () => definirFuncionariaAtiva({ id: funcionaria.id, ativa: false }),
                    () => {
                      setConfirmarDesligar(false);
                      setAberto(false);
                    },
                  )
                }
              >
                Desligar
              </Botao>
            </>
          }
        />
      ) : null}
    </>
  );
}
