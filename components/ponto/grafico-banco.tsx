"use client";

/**
 * Acumulado do banco semana a semana, com a hora de corte como limiar tracejado.
 * Série única (o título nomeia; sem caixa de legenda). Semana que fechou o corte ganha marcador
 * de status com ✓ — a cor sozinha não basta (terracota × verde falha para protanopia).
 * Hover/teclado: cursor que encaixa na semana mais próxima e mostra os valores. A tabela ao lado é a versão em texto.
 */
import { useRef, useState } from "react";

import { diaMes, duracao, somarDias } from "@/lib/ponto";

export interface PontoBanco {
  segunda: string;
  saldoAnteriorMin: number;
  extrasMin: number;
  ajustesMin: number;
  acumuladoMin: number;
  fechouCorte: boolean;
  segueMin: number;
}

const L = 44;
const R = 72;
const T = 14;
const B = 28;
const W = 720;
const H = 240;

const CHECK = "M -3 0 L -1 2.2 L 3.2 -2.4";

export function GraficoBanco({ pontos, corteMin }: { pontos: PontoBanco[]; corteMin: number }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  if (!pontos.length) return <div className="py-8 text-center text-sm text-tinta-3">Nenhuma semana fechada ainda.</div>;

  const maxH = Math.max(Math.ceil((Math.max(corteMin * 1.25, ...pontos.map((p) => p.acumuladoMin)) / 60) / 2) * 2, 2);
  const x = (i: number) => L + (pontos.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (pontos.length - 1));
  const y = (m: number) => T + (1 - Math.max(0, m) / (maxH * 60)) * (H - T - B);
  const ticks = Array.from({ length: maxH / 2 + 1 }, (_, i) => i * 2);
  const passo = Math.max(1, Math.ceil(pontos.length / 8));
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.acumuladoMin).toFixed(1)}`).join(" ");
  const ult = pontos.length - 1;
  const atual = ativo !== null ? pontos[ativo]! : null;

  function encaixar(clientX: number) {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((clientX - r.left) / r.width) * W;
    let melhor = 0;
    pontos.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i;
    });
    setAtivo(melhor);
  }

  return (
    <div
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-terracota focus-visible:ring-offset-2"
      tabIndex={0}
      role="group"
      aria-label={`Gráfico do acumulado do banco de horas, ${pontos.length} semanas. Use as setas para percorrer.`}
      onFocus={() => setAtivo((a) => a ?? ult)}
      onBlur={() => setAtivo(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setAtivo((a) => Math.max(0, (a ?? ult) - 1));
        if (e.key === "ArrowRight") setAtivo((a) => Math.min(ult, (a ?? ult) + 1));
      }}
    >
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-none" onPointerMove={(e) => encaixar(e.clientX)} onPointerLeave={() => setAtivo(null)} aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t * 60)} y2={y(t * 60)} stroke="var(--color-trilho)" strokeWidth={1} />
            <text x={L - 8} y={y(t * 60) + 4} textAnchor="end" fontSize={11} fill="var(--color-tinta-3)">
              {t}h
            </text>
          </g>
        ))}
        {pontos.map((p, i) =>
          i % passo === 0 || i === ult ? (
            <text key={p.segunda} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-tinta-3)">
              {diaMes(p.segunda)}
            </text>
          ) : null,
        )}

        {/* limiar: hora de corte */}
        <line x1={L} x2={W - R} y1={y(corteMin)} y2={y(corteMin)} stroke="var(--color-tinta-2)" strokeWidth={1} strokeDasharray="5 4" />
        <text x={W - R + 6} y={y(corteMin) + 4} fontSize={11} fill="var(--color-tinta-2)">
          corte {duracao(corteMin)}
        </text>

        <path d={linha} fill="none" stroke="var(--color-terracota)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {atual ? <line x1={x(ativo!)} x2={x(ativo!)} y1={T} y2={H - B} stroke="var(--color-tinta-3)" strokeWidth={1} /> : null}

        {pontos.map((p, i) =>
          p.fechouCorte ? (
            <g key={p.segunda} transform={`translate(${x(i)},${y(p.acumuladoMin)})`}>
              <circle r={7} fill="var(--color-sucesso)" stroke="#fff" strokeWidth={2} />
              <path d={CHECK} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ) : null,
        )}
        {!pontos[ult]!.fechouCorte ? <circle cx={x(ult)} cy={y(pontos[ult]!.acumuladoMin)} r={4.5} fill="var(--color-terracota)" stroke="#fff" strokeWidth={2} /> : null}
        {atual && !atual.fechouCorte && ativo !== ult ? (
          <circle cx={x(ativo!)} cy={y(atual.acumuladoMin)} r={4.5} fill="var(--color-terracota)" stroke="#fff" strokeWidth={2} />
        ) : null}
        <text x={x(ult) + 10} y={y(pontos[ult]!.acumuladoMin) - 8} fontSize={12} fontWeight={700} fill="var(--color-tinta)">
          {duracao(pontos[ult]!.acumuladoMin)}
        </text>
      </svg>

      {atual ? (
        <div
          className="pointer-events-none absolute top-1 z-10 flex w-52 flex-col gap-1 rounded-[10px] border border-borda bg-superficie p-3 text-[13px] shadow-[0_8px_24px_rgba(43,36,33,.14)]"
          style={{ left: `clamp(0px, calc(${(x(ativo!) / W) * 100}% - 104px), calc(100% - 208px))` }}
          role="status"
        >
          <span className="text-xs text-tinta-3">
            Semana {diaMes(atual.segunda)} a {diaMes(somarDias(atual.segunda, 4))}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded bg-terracota" />
            <b className="text-base">{duracao(atual.acumuladoMin)}</b>
            <span className="text-tinta-3">acumulado</span>
          </span>
          <span className="text-tinta-2">
            {duracao(atual.saldoAnteriorMin)} anterior + {duracao(atual.extrasMin)} extras
            {atual.ajustesMin ? ` ${atual.ajustesMin > 0 ? "+" : "−"} ${duracao(Math.abs(atual.ajustesMin))} ajuste` : ""}
          </span>
          {atual.fechouCorte ? <span className="font-bold text-sucesso">✓ Fechou o corte · 1 dia pago</span> : null}
          <span className="text-tinta-2">Segue {duracao(atual.segueMin)}</span>
        </div>
      ) : null}
    </div>
  );
}
