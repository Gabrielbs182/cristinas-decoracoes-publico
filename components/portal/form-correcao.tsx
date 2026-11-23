"use client";

import { Check, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { pedirCorrecao } from "@/app/meu-ponto/acoes";
import { Botao } from "@/components/ui/botao";
import { NOME_OCORRENCIA, NOME_TIPO, type TipoBatida } from "@/lib/ponto";
import { cn } from "@/lib/utils";

type Pedido = TipoBatida | "atestado" | "falta_justificada";

const BATIDAS: TipoBatida[] = ["E", "A", "V", "S"];
const OCORRENCIAS = ["atestado", "falta_justificada"] as const;
const LIMITE = 10 * 1024 * 1024;
/** Lado maior da foto depois de reduzida: legível para um atestado e leve no 4G. */
const LADO_MAX = 1600;

const mascaraHora = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

/**
 * Foto de celular tem 3–8 MB; reduz para JPEG antes de enviar. Se o navegador não souber abrir a
 * imagem (HEIC no Android, por exemplo), manda o original e o servidor valida o tipo e o tamanho.
 */
async function prepararAnexo(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) return arquivo;
  try {
    const img = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob || blob.size >= arquivo.size) return arquivo;
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
}

export function FormCorrecao({ dias, diaInicial, tipoInicial }: { dias: { valor: string; rotulo: string }[]; diaInicial: string; tipoInicial: TipoBatida | null }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [dia, setDia] = useState(diaInicial);
  const [pedido, setPedido] = useState<Pedido | null>(tipoInicial);
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [preparando, setPreparando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const ehBatida = pedido !== null && pedido.length === 1;
  const horaOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
  const pronto = !!dia && pedido !== null && (!ehBatida || horaOk) && motivo.trim().length >= 3 && !preparando;

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setPreparando(true);
    const preparado = await prepararAnexo(arquivo);
    setPreparando(false);
    if (preparado.size > LIMITE) {
      toast.error("Arquivo grande demais (máximo 10 MB).");
      return;
    }
    setAnexo(preparado);
  };

  const enviar = () => {
    if (!pronto) return;
    const fd = new FormData();
    fd.set("data", dia);
    fd.set("pedido", pedido!);
    if (ehBatida) fd.set("hora", hora);
    fd.set("motivo", motivo);
    if (anexo) fd.set("foto", anexo);
    iniciar(async () => {
      const r = await pedirCorrecao(fd);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      router.push("/meu-ponto/solicitacoes");
    });
  };

  const opcao = (ativo: boolean) =>
    cn(
      "min-h-[50px] cursor-pointer rounded-[10px] border-[1.5px] px-2 text-sm font-extrabold",
      ativo ? "border-terracota bg-terracota-claro text-terracota-escuro" : "border-borda-campo bg-superficie text-tinta",
    );

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Dia</span>
        <select value={dia} onChange={(e) => setDia(e.target.value)} className="h-[50px] rounded-[10px] border border-borda-campo bg-superficie px-3 text-base">
          {dias.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.rotulo}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-bold">Qual batida?</legend>
        <div className="grid grid-cols-2 gap-2">
          {BATIDAS.map((t) => (
            <button key={t} type="button" aria-pressed={pedido === t} className={opcao(pedido === t)} onClick={() => setPedido(t)}>
              {NOME_TIPO[t]}
            </button>
          ))}
        </div>
        <span className="mt-1.5 text-[13px] font-semibold text-tinta-3">Ou, se não veio trabalhar:</span>
        <div className="grid grid-cols-2 gap-2">
          {OCORRENCIAS.map((o) => (
            <button key={o} type="button" aria-pressed={pedido === o} className={opcao(pedido === o)} onClick={() => setPedido(o)}>
              {NOME_OCORRENCIA[o]}
            </button>
          ))}
        </div>
      </fieldset>

      {ehBatida ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Horário</span>
          <input
            value={hora}
            onChange={(e) => setHora(mascaraHora(e.target.value))}
            inputMode="numeric"
            placeholder="HH:MM"
            aria-invalid={hora.length === 5 && !horaOk}
            className="h-[58px] rounded-[10px] border border-borda-campo bg-superficie px-3.5 text-[26px] font-extrabold tracking-[.04em] placeholder:text-tinta-4"
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Motivo</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={ehBatida || pedido === null ? "Ex.: esqueci de bater na volta do almoço" : "Ex.: consulta médica, atestado em anexo"}
          className="resize-none rounded-[10px] border border-borda-campo bg-superficie px-3.5 py-3 text-base placeholder:text-tinta-4"
        />
      </label>

      <input
        ref={entrada}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          void escolherArquivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {anexo ? (
        <div className="flex min-h-14 items-center gap-2.5 rounded-[10px] border-[1.5px] border-sucesso bg-sucesso-fundo px-3 text-sm font-bold text-sucesso">
          <Check className="size-5 flex-none" />
          <span className="flex-1 truncate">{anexo.name}</span>
          <button type="button" aria-label="Remover anexo" className="grid size-11 cursor-pointer place-items-center rounded-lg" onClick={() => setAnexo(null)}>
            <X className="size-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={preparando}
          onClick={() => entrada.current?.click()}
          className="flex min-h-14 cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-tracejado bg-superficie px-2 text-sm font-bold text-tinta-2"
        >
          <Paperclip className="size-5" />
          {preparando ? "Preparando a foto…" : "Anexar foto ou atestado (opcional)"}
        </button>
      )}

      <Botao type="submit" disabled={!pronto || enviando} className="h-[54px] rounded-xl text-base font-extrabold">
        {enviando ? "Enviando…" : "Enviar para a gestora"}
      </Botao>
    </form>
  );
}
