"use client";

import { Check, Copy, FileDown, MessageCircle, Pencil, Send, Undo2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { mudarSituacao } from "@/app/(gestao)/orcamentos/acoes";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { whatsappDoTelefone } from "@/lib/vendas/numeros";
import type { StatusOrcamento } from "@/lib/vendas/orcamento";

type Para = "enviado" | "aprovado" | "recusado" | "rascunho" | "cancelado";

export interface DadosEnvio {
  id: string;
  numero: string;
  situacao: StatusOrcamento | "vencido";
  validadeDias: number;
  linkCliente: string;
  clienteNome: string;
  clienteTelefone: string;
  enderecoObra: string;
}

function mensagem(d: DadosEnvio): string {
  const obra = d.enderecoObra ? ` da obra em ${d.enderecoObra.split(" — ")[0]}` : "";
  return `Olá, ${d.clienteNome.split(" ")[0]}! Segue o orçamento nº ${d.numero} das cortinas e persianas${obra}. Você pode ver os detalhes, baixar o PDF e aprovar pelo link: ${d.linkCliente}`;
}

/** Botões da situação. `garantirSalvo` grava o rascunho pendente antes de qualquer mudança. */
export function AcoesOrcamento({ d, garantirSalvo, temRecibo = false }: { d: DadosEnvio; garantirSalvo: () => Promise<boolean>; temRecibo?: boolean }) {
  const [enviando, iniciar] = useTransition();
  const [dialogo, setDialogo] = useState<null | "enviar" | "enviado" | "aprovar" | "recusar" | "editar" | "descartar" | "desfazer">(null);
  const [motivo, setMotivo] = useState("");
  const texto = mensagem(d);
  const whats = `${whatsappDoTelefone(d.clienteTelefone) ?? "https://wa.me/"}?text=${encodeURIComponent(texto)}`;
  const pdf = `/arquivos/orcamento/${d.id}`;

  const mudar = (para: Para, depois?: () => void) =>
    iniciar(async () => {
      if (!(await garantirSalvo())) return;
      const r = await mudarSituacao({ id: d.id, para, motivo: para === "recusado" ? motivo : undefined });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      if (depois) depois();
      else setDialogo(null);
    });

  const previa = () =>
    iniciar(async () => {
      if (await garantirSalvo()) window.open(pdf, "_blank");
    });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não deu para copiar. Selecione o texto e copie.");
    }
  };

  const fechar = () => setDialogo(null);
  const confirmar = (titulo: string, descricao: string, para: Para, rotulo: string, variante: "primario" | "perigo" | "sucesso" = "primario") => (
    <Dialogo
      aberto
      aoMudar={(a) => !a && fechar()}
      titulo={titulo}
      descricao={descricao}
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao variante={variante} disabled={enviando} onClick={() => mudar(para)}>
            {rotulo}
          </Botao>
        </>
      }
    />
  );

  const s = d.situacao;
  return (
    <div className="flex flex-col gap-2">
      {s === "rascunho" ? (
        <>
          <Botao tamanho="g" className="font-extrabold" disabled={enviando} onClick={() => iniciar(async () => void ((await garantirSalvo()) && setDialogo("enviar")))}>
            <Send /> Enviar ao cliente
          </Botao>
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="secundario" disabled={enviando} onClick={previa}>
              <FileDown /> Pré-visualizar
            </Botao>
            <Botao variante="perigo" disabled={enviando} onClick={() => setDialogo("descartar")}>
              <X /> Descartar
            </Botao>
          </div>
        </>
      ) : null}
      {s === "enviado" || s === "vencido" ? (
        <>
          <Botao variante="sucesso" tamanho="g" className="font-extrabold" onClick={() => setDialogo("aprovar")}>
            <Check /> Marcar como aprovado
          </Botao>
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="secundario" onClick={() => setDialogo("enviado")}>
              <MessageCircle /> Reenviar
            </Botao>
            <Botao variante="perigo" onClick={() => setDialogo("recusar")}>
              <X /> Recusado
            </Botao>
          </div>
          <Botao variante="secundario" onClick={() => setDialogo("editar")}>
            <Pencil /> Voltar a editar
          </Botao>
        </>
      ) : null}
      {s === "aprovado" && !temRecibo ? (
        <Botao variante="secundario" onClick={() => setDialogo("desfazer")}>
          <Undo2 /> Desfazer aprovação
        </Botao>
      ) : null}
      {s === "aprovado" && temRecibo ? <span className="text-xs text-pretty text-tinta-3">Com recibo emitido, a aprovação não se desfaz (cancele os recibos antes).</span> : null}
      {s === "recusado" ? (
        <Botao variante="secundario" onClick={() => setDialogo("editar")}>
          <Pencil /> Voltar a editar
        </Botao>
      ) : null}
      {s !== "rascunho" ? (
        <a href={pdf} target="_blank" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-borda-campo bg-superficie text-sm font-semibold text-tinta no-underline">
          <FileDown className="size-4" /> PDF do orçamento
        </a>
      ) : null}

      {dialogo === "enviar" ? (
        <Dialogo
          aberto
          aoMudar={(a) => !a && fechar()}
          titulo={`Enviar o orçamento nº ${d.numero}`}
          descricao={`Para ${d.clienteNome}${d.clienteTelefone ? ` · ${d.clienteTelefone}` : ""}. A situação muda para Enviado e a validade de ${d.validadeDias} dias começa a contar hoje. Depois disso o orçamento não muda (dá para voltar a editar e enviar de novo).`}
          rodape={
            <>
              <Botao variante="secundario" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao disabled={enviando} onClick={() => mudar("enviado", () => setDialogo("enviado"))}>
                <Send /> Marcar como enviado
              </Botao>
            </>
          }
        >
          <div className="rounded-lg bg-suave p-3 text-[13px] text-pretty">{texto}</div>
        </Dialogo>
      ) : null}
      {dialogo === "enviado" ? (
        <Dialogo
          aberto
          aoMudar={(a) => !a && fechar()}
          titulo="Mande para a cliente"
          descricao="Pelo link ela vê o orçamento, baixa o PDF e aprova. Abrir o link não aprova nada."
          rodape={
            <>
              <Botao variante="secundario" onClick={copiar}>
                <Copy /> Copiar mensagem
              </Botao>
              <a
                href={whats}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-sucesso px-4 text-sm font-bold text-white no-underline hover:bg-[#245a39]"
              >
                <MessageCircle className="size-4" /> Abrir o WhatsApp
              </a>
            </>
          }
        >
          <textarea readOnly value={texto} rows={4} aria-label="Mensagem para a cliente" className="w-full resize-none rounded-lg border border-borda-campo bg-suave p-3 text-[13px]" onFocus={(e) => e.target.select()} />
          {!whatsappDoTelefone(d.clienteTelefone) ? <span className="text-xs text-atencao">O telefone do cliente não tem DDD: o WhatsApp vai pedir para escolher a conversa.</span> : null}
        </Dialogo>
      ) : null}
      {dialogo === "aprovar" ? confirmar(`Marcar o nº ${d.numero} como aprovado?`, "Use quando a cliente aprovou por telefone, WhatsApp ou pessoalmente.", "aprovado", "Marcar como aprovado", "sucesso") : null}
      {dialogo === "desfazer" ? confirmar("Desfazer a aprovação?", "O orçamento volta para Enviado (aguardando resposta).", "enviado", "Desfazer aprovação") : null}
      {dialogo === "editar"
        ? confirmar(
            "Voltar a editar?",
            "O orçamento volta para rascunho: o link da cliente deixa de mostrá-lo até você enviar de novo, e a validade recomeça no novo envio.",
            "rascunho",
            "Voltar a editar",
          )
        : null}
      {dialogo === "descartar" ? confirmar(`Descartar o rascunho nº ${d.numero}?`, "Ele fica guardado como cancelado (o número não é reaproveitado).", "cancelado", "Descartar", "perigo") : null}
      {dialogo === "recusar" ? (
        <Dialogo
          aberto
          aoMudar={(a) => !a && fechar()}
          titulo={`O nº ${d.numero} foi recusado`}
          descricao="O motivo ajuda a entender as vendas perdidas (opcional)."
          rodape={
            <>
              <Botao variante="secundario" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao variante="perigo" disabled={enviando} onClick={() => mudar("recusado")}>
                Marcar como recusado
              </Botao>
            </>
          }
        >
          <Campo value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: achou caro, fechou com outra loja" maxLength={500} aria-label="Motivo da recusa" />
        </Dialogo>
      ) : null}
    </div>
  );
}
