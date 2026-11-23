import { ICONES, Selo, type TomSelo } from "@/components/ui/selo";
import type { Situacao } from "@/lib/ponto";

export const SITUACAO: Record<Situacao, { tom: TomSelo; icone: keyof typeof ICONES; rotulo: string }> = {
  ok: { tom: "ok", icone: "check", rotulo: "OK" },
  pendencia: { tom: "perigo", icone: "alerta", rotulo: "Pendência" },
  aviso: { tom: "atencao", icone: "alerta", rotulo: "Aviso" },
  ajustado: { tom: "ajuste", icone: "lapis", rotulo: "Ajustado" },
  falta: { tom: "perigo", icone: "x", rotulo: "Falta" },
  atestado: { tom: "info", icone: "mais", rotulo: "Atestado" },
  falta_justificada: { tom: "info", icone: "mais", rotulo: "Falta justificada" },
  feriado: { tom: "neutro", icone: "estrela", rotulo: "Feriado" },
  folga: { tom: "neutro", icone: "circulo", rotulo: "Folga" },
  sem_jornada: { tom: "neutro", icone: "circulo", rotulo: "Sem jornada" },
};

export const LEGENDA: Situacao[] = ["ok", "pendencia", "aviso", "ajustado", "falta", "atestado", "feriado", "folga"];

export function SeloSituacao({ situacao, tamanho }: { situacao: Situacao; tamanho?: "m" | "g" }) {
  const s = SITUACAO[situacao];
  return (
    <Selo tom={s.tom} icone={s.icone} tamanho={tamanho}>
      {s.rotulo}
    </Selo>
  );
}
