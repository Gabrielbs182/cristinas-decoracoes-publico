/** Linha do tempo do dia (06:00–20:00): batidas como marcadores, períodos como barras, jornada prevista tracejada. */
import { type BatidaDia, horaDeSeg, minDeHhmm, type ResultadoDia } from "@/lib/ponto";

const INICIO = 6 * 60;
const FIM = 20 * 60;
const pos = (min: number) => `${((Math.min(Math.max(min, INICIO), FIM) - INICIO) / (FIM - INICIO)) * 100}%`;
/** Onde desenhar a batida "fantasma": o horário original da catraca, se foi alterada. */
const minFantasma = (b: BatidaDia) => (b.horaOriginal ? (minDeHhmm(b.horaOriginal) ?? b.horaSeg / 60) : b.horaSeg / 60);
const larg = (a: number, b: number) => `${((Math.min(b, FIM) - Math.max(a, INICIO)) / (FIM - INICIO)) * 100}%`;

export function LinhaDoTempo({ dia }: { dia: ResultadoDia }) {
  const validas = dia.batidas.filter((b) => b.tipo !== null && !b.excedente);
  const incompleto = dia.pendencias.some((p) => p.severidade === "bloqueia");
  const segmentos = validas.slice(0, -1).map((b, i) => {
    const prox = validas[i + 1]!;
    const trabalho = b.tipo === "E" || b.tipo === "V";
    const a = b.horaSeg / 60;
    const z = prox.horaSeg / 60;
    const rotulo = trabalho ? (b.tipo === "E" && prox.tipo === "A" ? "Manhã" : b.tipo === "V" ? "Tarde" : "Trabalho") : incompleto && prox.tipo === "S" ? "sem volta registrada" : "Almoço";
    return { a, z, trabalho, rotulo, alerta: !trabalho && incompleto && prox.tipo === "S" };
  });
  const fantasmas = dia.batidas.filter((b) => b.horaOriginal || b.desconsiderada || b.duplicadaDe);
  const previsto = dia.previsto;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda bg-superficie px-3.5 pt-3.5 pb-2.5">
      <div className="flex justify-between text-xs font-semibold text-tinta-3">
        <span>Linha do tempo</span>
        <span>
          {previsto
            ? `Jornada prevista ${horaDeSeg(previsto.entradaMin * 60)}–${horaDeSeg(previsto.saidaMin * 60)}`
            : "Sem jornada prevista neste dia"}
        </span>
      </div>
      <div className="relative h-24" aria-hidden>
        {previsto ? (
          <div
            className="absolute top-[30px] h-9 rounded-md border-[1.5px] border-dashed border-[#a89c90]"
            style={{ left: pos(previsto.entradaMin), width: larg(previsto.entradaMin, previsto.saidaMin) }}
          />
        ) : null}
        <div className="absolute inset-x-0 top-[47px] h-0.5 bg-trilho" />
        {segmentos.map((s, i) => (
          <div
            key={i}
            className="absolute top-[38px] flex h-5 items-center justify-center overflow-hidden rounded"
            style={{
              left: pos(s.a),
              width: larg(s.a, s.z),
              background: s.trabalho
                ? "var(--color-terracota-barra)"
                : s.alerta
                  ? "repeating-linear-gradient(45deg,#f6d3d8 0 4px,#fdf0f2 4px 8px)"
                  : "repeating-linear-gradient(45deg,#e9dfd3 0 4px,#f6f1ea 4px 8px)",
            }}
          >
            <span className={`truncate px-1 text-[10px] font-extrabold ${s.trabalho ? "text-white" : s.alerta ? "text-perigo" : "text-tinta-3"}`}>{s.rotulo}</span>
          </div>
        ))}
        {fantasmas.map((b) => (
          <div key={`f${b.ref}`}>
            <div
              className="absolute top-10 size-3.5 -ml-[7px] rounded-full border-2 border-dashed border-perigo bg-superficie"
              style={{ left: pos(minFantasma(b)) }}
            />
            <div
              className="absolute top-[72px] -translate-x-1/2 text-[10px] whitespace-nowrap text-perigo line-through"
              style={{ left: pos(minFantasma(b)) }}
            >
              {b.horaOriginal ?? b.hora}
            </div>
          </div>
        ))}
        {validas.map((b) => {
          const cor = b.origem === "catraca" && !b.ajustada ? "var(--color-tinta)" : "var(--color-ajuste)";
          return (
            <div key={b.ref}>
              <div
                className="absolute top-[39px] size-4 -ml-2 rounded-full border-[3px] border-superficie"
                style={{ left: pos(b.horaSeg / 60), background: cor, boxShadow: `0 0 0 1px ${cor}` }}
              />
              <div className="absolute top-3 -translate-x-1/2 text-xs font-extrabold whitespace-nowrap" style={{ left: pos(b.horaSeg / 60), color: cor }}>
                {b.hora}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-tinta-3">
        {["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}
