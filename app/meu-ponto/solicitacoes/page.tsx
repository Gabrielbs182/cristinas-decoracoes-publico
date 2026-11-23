import { Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TituloPortal } from "@/components/portal/titulo";
import { estilosBotao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/selo";
import { exigirPapel } from "@/lib/auth";
import { diaMes, horaDeSeg, NOME_OCORRENCIA, NOME_TIPO } from "@/lib/ponto";
import { enderecoDoAnexo } from "@/lib/ponto/solicitacoes";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Minhas solicitações" };

const SITUACAO = {
  pendente: { tom: "atencao", icone: "relogio", rotulo: "Aguardando" },
  aprovada: { tom: "ok", icone: "check", rotulo: "Aprovada" },
  recusada: { tom: "perigo", icone: "x", rotulo: "Recusada" },
} as const;

export default async function MinhasSolicitacoes() {
  const sessao = await exigirPapel("funcionaria");
  const supabase = await criarClienteServidor();
  const { data: pedidos } = await supabase
    .from("solicitacoes_correcao")
    .select("id, data, tipo_batida, hora_seg, ocorrencia, motivo, anexo_path, status, resposta")
    .eq("funcionaria_id", sessao.funcionariaId!)
    .order("criada_em", { ascending: false })
    .limit(50);

  return (
    <>
      <TituloPortal contexto="Seus pedidos de correção" titulo="Minhas solicitações" />
      <Link href="/meu-ponto/corrigir" className={estilosBotao({ variante: "secundario", tamanho: "g", className: "font-extrabold" })}>
        Pedir correção
      </Link>
      {!pedidos?.length ? (
        <div className="rounded-xl border border-dashed border-tracejado bg-superficie p-6 text-center text-sm text-tinta-3">Você ainda não fez nenhum pedido.</div>
      ) : (
        pedidos.map((s) => {
          const st = SITUACAO[s.status];
          return (
            <div key={s.id} className="flex flex-col gap-2 rounded-[14px] border border-borda bg-superficie px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <b className="text-[15px]">
                  {diaMes(s.data)} · {s.tipo_batida ? NOME_TIPO[s.tipo_batida] : NOME_OCORRENCIA[s.ocorrencia!]}
                </b>
                <Selo tom={st.tom} icone={st.icone} tamanho="g">
                  {st.rotulo}
                </Selo>
              </div>
              <span className="text-sm text-pretty">
                {s.hora_seg != null ? (
                  <>
                    Pedido: <b>{horaDeSeg(s.hora_seg)}</b> ·{" "}
                  </>
                ) : null}
                {s.motivo}
              </span>
              {s.anexo_path ? (
                <a href={enderecoDoAnexo(s.anexo_path)} target="_blank" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-bold">
                  <Paperclip className="size-4" /> Ver anexo
                </a>
              ) : null}
              {s.resposta ? (
                <div className="rounded-lg bg-suave px-3 py-2.5 text-sm text-pretty">
                  <b>Gestora:</b> {s.resposta}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </>
  );
}
