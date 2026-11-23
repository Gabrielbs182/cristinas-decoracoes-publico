"use client";

import { useState } from "react";

import { ignorarIdCatraca, vincularIdCatraca } from "@/app/(gestao)/ponto/acoes";
import { Botao } from "@/components/ui/botao";
import { Campo, Selecao } from "@/components/ui/campos";
import { Selo } from "@/components/ui/selo";
import { dataBr } from "@/lib/ponto";
import type { IdDesconhecido } from "@/lib/ponto/servidor";

import { useAcao } from "./usar-acao";

export function CartaoIdDesconhecido({ id, semVinculo }: { id: IdDesconhecido; semVinculo: { id: string; nome: string }[] }) {
  const { enviando, executar } = useAcao();
  const [funcionaria, setFuncionaria] = useState("");
  const [ignorando, setIgnorando] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-perigo-borda bg-[#fdf3f4] p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Selo tom="perigo" icone="alerta">
          Bloqueia
        </Selo>
        <b className="text-[15px]">ID {id.enNo.replace(/^0+/, "")} desconhecido na catraca</b>
        <span className="text-[13px] text-tinta-3">
          {id.batidas} batida(s) em {id.dias.map(dataBr).join(", ")}
        </span>
      </div>
      <div className="text-sm text-tinta-2">Essas batidas não pertencem a nenhuma funcionária cadastrada. Vincule a quem bateu ou ignore (as batidas continuam guardadas).</div>
      <div className="flex flex-wrap gap-2">
        <Selecao value={funcionaria} onChange={(e) => setFuncionaria(e.target.value)} className="w-auto min-w-56" aria-label="Vincular a">
          <option value="">{semVinculo.length ? "Vincular a…" : "Nenhuma funcionária sem ID"}</option>
          {semVinculo.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Selecao>
        <Botao disabled={!funcionaria || enviando} onClick={() => executar(() => vincularIdCatraca({ enNo: id.enNo, funcionariaId: funcionaria }))}>
          Vincular
        </Botao>
        <Botao variante="secundario" onClick={() => setIgnorando((i) => !i)}>
          Ignorar este ID
        </Botao>
      </div>
      {ignorando ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            executar(() => ignorarIdCatraca({ enNo: id.enNo, motivo }));
          }}
        >
          <Campo autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que ignorar? (ex.: cadastro de teste no relógio)" className="min-w-60 flex-1" />
          <Botao type="submit" variante="escuro" disabled={enviando || motivo.trim().length < 3}>
            Ignorar
          </Botao>
        </form>
      ) : null}
    </div>
  );
}
