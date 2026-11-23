/**
 * Espelho de ponto semanal em PDF (A4, uma página), gerado da fotografia do fechamento.
 * Visual do sistema: Jost nos títulos, Manrope no texto, terracota como acento, status com texto.
 */
import path from "node:path";

import PDFDocument from "pdfkit";

import { dataBr, diaMes, duracao, hhmm, isoDow, type Regras, SIGLA_DIA, somarDias } from "@/lib/ponto";

import type { Empresa, EspelhoFuncionaria } from "./dados";

const COR = {
  tinta: "#2B2421",
  tinta2: "#4A403A",
  tinta3: "#6E635B",
  tinta4: "#8A7F76",
  borda: "#E5DDD1",
  trilho: "#EFE8DD",
  suave: "#FAF7F2",
  terracota: "#A04A2A",
  sucesso: "#2E6E47",
  sucessoFundo: "#E3F0E7",
  perigo: "#B0263A",
  faltaFundo: "#FDF3F4",
  ajuste: "#6B4A8E",
  info: "#2D5B82",
  neutro: "#5E554E",
};

const SITUACAO: Record<string, { rotulo: string; cor: string }> = {
  ok: { rotulo: "OK", cor: COR.sucesso },
  ajustado: { rotulo: "Ajustado", cor: COR.ajuste },
  falta: { rotulo: "Falta", cor: COR.perigo },
  atestado: { rotulo: "Atestado", cor: COR.info },
  falta_justificada: { rotulo: "Falta justificada", cor: COR.info },
  folga: { rotulo: "Folga", cor: COR.neutro },
  feriado: { rotulo: "Feriado", cor: COR.neutro },
  aviso: { rotulo: "Aviso", cor: COR.tinta2 },
  pendencia: { rotulo: "Pendência", cor: COR.perigo },
  sem_jornada: { rotulo: "—", cor: COR.tinta3 },
};

const FONTES = path.join(process.cwd(), "node_modules", "@fontsource");
const LOGO = path.join(process.cwd(), "public", "logo-circulo.png");

export interface DadosEspelho {
  empresa: Empresa;
  segunda: string;
  fechadaEm: string | null;
  regras: Regras;
  funcionaria: EspelhoFuncionaria;
  versao: string;
  geradoEm?: Date;
}

const quando = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function gerarEspelhoPdf(d: DadosEspelho): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    // Margem de baixo menor: o rodapé fica em y=800 e, com 40, o pdfkit abriria uma 2ª página só para ele.
    margins: { top: 40, left: 40, right: 40, bottom: 16 },
    info: {
      Title: `Espelho de ponto · ${d.funcionaria.nome} · ${dataBr(d.segunda)} a ${dataBr(somarDias(d.segunda, 4))}`,
      Author: d.empresa.nome,
      Creator: `Sistema ${d.empresa.nome} ${d.versao}`,
    },
  });
  doc.registerFont("corpo", path.join(FONTES, "manrope/files/manrope-latin-400-normal.woff"));
  doc.registerFont("medio", path.join(FONTES, "manrope/files/manrope-latin-600-normal.woff"));
  doc.registerFont("forte", path.join(FONTES, "manrope/files/manrope-latin-700-normal.woff"));
  doc.registerFont("titulo", path.join(FONTES, "jost/files/jost-latin-400-normal.woff"));

  const pedacos: Buffer[] = [];
  doc.on("data", (c: Buffer) => pedacos.push(c));
  const pronto = new Promise<Buffer>((ok, erro) => {
    doc.on("end", () => ok(Buffer.concat(pedacos)));
    doc.on("error", erro);
  });

  const X = 40;
  const L = 515; // largura útil
  const r = d.funcionaria.resultado;
  const { horaCorteMin, toleranciaCorteMin } = d.regras;
  const texto = (s: string, x: number, y: number, o: { fonte?: string; tam?: number; cor?: string; largura?: number; alinhar?: "left" | "right" | "center"; espaco?: number } = {}) => {
    doc
      .font(o.fonte ?? "corpo")
      .fontSize(o.tam ?? 10)
      .fillColor(o.cor ?? COR.tinta)
      .text(s, x, y, { width: o.largura, align: o.alinhar ?? "left", lineBreak: !!o.largura && o.alinhar !== "right", characterSpacing: o.espaco ?? 0 });
  };
  const linha = (y: number, cor = COR.trilho, x1 = X, x2 = X + L) => doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.8).strokeColor(cor).stroke();

  // ---------------------------------------------------------------- cabeçalho
  doc.image(LOGO, X, 34, { width: 58, height: 58 });
  texto(d.empresa.nome, X + 70, 44, { fonte: "titulo", tam: 17 });
  const contato = [d.empresa.cnpj && `CNPJ ${d.empresa.cnpj}`, d.empresa.telefone, d.empresa.cidadeUf].filter(Boolean).join(" · ");
  texto(contato || "Sistema de gestão", X + 70, 66, { tam: 8, cor: COR.tinta3 });

  texto("ESPELHO DE PONTO", X + L - 220, 40, { fonte: "forte", tam: 8, cor: COR.terracota, largura: 220, alinhar: "right", espaco: 1.2 });
  texto(`${diaMes(d.segunda)} a ${dataBr(somarDias(d.segunda, 4))}`, X + L - 220, 52, { fonte: "titulo", tam: 15, largura: 220, alinhar: "right" });
  if (d.fechadaEm) texto(`Semana fechada em ${quando(new Date(d.fechadaEm))}`, X + L - 220, 74, { tam: 8, cor: COR.tinta3, largura: 220, alinhar: "right" });
  linha(104, COR.borda);

  texto("FUNCIONÁRIA", X, 118, { fonte: "forte", tam: 7.5, cor: COR.tinta3, espaco: 0.8 });
  texto(d.funcionaria.nome, X, 129, { fonte: "titulo", tam: 21 });
  texto(`Jornada: seg a qui ${duracao(d.regras.cargaSegQuiMin)} · sex ${duracao(d.regras.cargaSexMin)} · almoço de ${duracao(d.regras.almocoPadraoMin)}`, X + L - 260, 134, { tam: 8.5, cor: COR.tinta3, largura: 260, alinhar: "right" });

  // ---------------------------------------------------------------- tabela da semana
  const cols = [
    { t: "Dia", w: 64, a: "left" as const },
    { t: "Entrada", w: 54 },
    { t: "Saída almoço", w: 62 },
    { t: "Volta almoço", w: 62 },
    { t: "Saída", w: 52 },
    { t: "Trabalhadas", w: 68 },
    { t: "Extras", w: 52 },
    { t: "Situação", w: 101 },
  ];
  let y = 168;
  // Cabeçalho com altura para duas linhas ("SAÍDA / ALMOÇO").
  doc.rect(X, y, L, 30).fill(COR.suave);
  let x = X;
  for (const c of cols) {
    texto(c.t.toUpperCase(), x + 8, y + 7, { fonte: "forte", tam: 7, cor: COR.tinta3, largura: c.w - 12, alinhar: c.a ?? "left", espaco: 0.4 });
    x += c.w;
  }
  y += 30;

  for (const dia of d.funcionaria.dias) {
    const falta = dia.trabalhadas_min === null && dia.situacao === "falta";
    if (falta) doc.rect(X, y, L, 26).fill(COR.faltaFundo);
    const s = SITUACAO[dia.situacao] ?? SITUACAO.ok!;
    const celulas = [
      `${SIGLA_DIA[isoDow(dia.data)]} ${diaMes(dia.data)}`,
      dia.entrada ?? "—",
      dia.saida_almoco ?? "—",
      dia.volta_almoco ?? "—",
      dia.saida ?? "—",
      dia.situacao === "atestado" || dia.situacao === "falta_justificada"
        ? "Abonado"
        : dia.situacao === "feriado" || dia.situacao === "folga"
          ? "—"
          : dia.trabalhadas_min === null
            ? "Falta"
            : hhmm(dia.trabalhadas_min),
      dia.extra_min ? `+${duracao(dia.extra_min)}` : "—",
      s.rotulo,
    ];
    x = X;
    celulas.forEach((v, i) => {
      const c = cols[i]!;
      const vazio = v === "—";
      texto(v, x + 8, y + 8, {
        fonte: i === 0 || i === 5 ? "forte" : i === 7 ? "medio" : "corpo",
        tam: i === 7 ? 9 : 9.5,
        cor: i === 7 ? s.cor : vazio ? COR.tinta4 : COR.tinta,
        largura: c.w - 12,
      });
      x += c.w;
    });
    y += 26;
    linha(y);
  }
  // total da semana
  texto("Semana", X + 8, y + 9, { fonte: "forte", tam: 9.5 });
  texto(`${r.dias_trabalhados} ${r.dias_trabalhados === 1 ? "dia trabalhado" : "dias trabalhados"}`, X + cols[0]!.w + 8, y + 9.5, { tam: 8.5, cor: COR.tinta3 });
  texto(hhmm(r.trabalhadas_min), X + cols.slice(0, 5).reduce((t, c) => t + c.w, 0) + 8, y + 9, { fonte: "forte", tam: 9.5 });
  texto(`+${duracao(r.extras_semana_min)}`, X + cols.slice(0, 6).reduce((t, c) => t + c.w, 0) + 8, y + 9, { fonte: "forte", tam: 9.5 });
  y += 30;
  linha(y, COR.borda);

  // ---------------------------------------------------------------- banco de horas
  y += 20;
  texto("Banco de horas", X, y, { fonte: "titulo", tam: 15 });
  y += 26;
  const linhasBanco: [string, string, boolean][] = [
    ["Saldo anterior", duracao(r.saldo_anterior_min), false],
    ["Extras da semana", `+${duracao(r.extras_semana_min)}`, false],
    ...(r.ajustes_min ? [["Ajuste de saldo", `${r.ajustes_min > 0 ? "+" : "−"}${duracao(Math.abs(r.ajustes_min))}`, false] as [string, string, boolean]] : []),
    ["Acumulado", duracao(r.acumulado_min), true],
    [`Hora de corte (tolerância ${toleranciaCorteMin} min)`, duracao(horaCorteMin), false],
    ["Segue para a próxima semana", duracao(r.proxima_semana_min), true],
  ];
  const yBanco = y;
  for (const [rotulo, valor, forte] of linhasBanco) {
    texto(rotulo, X, y, { fonte: forte ? "forte" : "corpo", tam: 10, cor: forte ? COR.tinta : COR.tinta2 });
    texto(valor, X + 160, y, { fonte: forte ? "forte" : "corpo", tam: 10, largura: 120, alinhar: "right" });
    y += 18;
    linha(y - 5, COR.trilho, X, X + 280);
  }

  const bx = X + 305;
  const bw = L - 305;
  const bh = Math.max(y - yBanco - 5, 84);
  if (r.fechou_corte) {
    doc.roundedRect(bx, yBanco - 6, bw, bh, 8).fill(COR.sucessoFundo);
    // Ícone desenhado: o ✓ não existe no subconjunto latino da fonte.
    doc.circle(bx + 21, yBanco + 12, 7).fill(COR.sucesso);
    doc.moveTo(bx + 17.5, yBanco + 12).lineTo(bx + 20, yBanco + 14.6).lineTo(bx + 24.6, yBanco + 9.6).lineWidth(1.6).strokeColor("#FFFFFF").stroke();
    texto("Fechou a hora de corte", bx + 34, yBanco + 6, { fonte: "forte", tam: 11, cor: COR.sucesso, largura: bw - 48 });
    texto(
      `1 dia pago nesta semana. O que passou de ${duracao(horaCorteMin)} (${duracao(r.proxima_semana_min)}) segue para a próxima semana.`,
      bx + 14,
      yBanco + 26,
      { tam: 9, cor: COR.tinta2, largura: bw - 28 },
    );
  } else {
    doc.roundedRect(bx, yBanco - 6, bw, bh, 8).fill(COR.suave);
    texto(`Faltam ${duracao(Math.max(0, horaCorteMin - r.acumulado_min))} para a hora de corte`, bx + 14, yBanco + 6, { fonte: "forte", tam: 11, largura: bw - 28 });
    texto(
      `Ao chegar a ${duracao(horaCorteMin)} (com ${toleranciaCorteMin} min de tolerância), a funcionária ganha 1 dia pago. O acumulado segue para a próxima semana.`,
      bx + 14,
      yBanco + 26,
      { tam: 9, cor: COR.tinta2, largura: bw - 28 },
    );
  }
  y = Math.max(y, yBanco + bh) + 14;

  for (const a of d.funcionaria.ajustes) {
    texto(`Ajuste de saldo (${a.minutos > 0 ? "+" : "−"}${duracao(Math.abs(a.minutos))}): ${a.motivo}`, X, y, { tam: 8.5, cor: COR.tinta2, largura: L });
    y = doc.y + 4;
  }
  if (d.funcionaria.dias.some((dia) => dia.ajustado)) {
    texto(
      "Dias marcados como Ajustado tiveram batida corrigida ou pendência resolvida pela gestora, com o motivo registrado no sistema.",
      X,
      y,
      { tam: 8, cor: COR.tinta3, largura: L },
    );
  }

  // ---------------------------------------------------------------- assinaturas
  const ya = 724;
  texto("Data: ____/____/________", X, ya - 30, { tam: 9, cor: COR.tinta2 });
  linha(ya, COR.tinta2, X, X + 230);
  linha(ya, COR.tinta2, X + L - 230, X + L);
  texto(d.funcionaria.nome, X, ya + 6, { fonte: "medio", tam: 9, largura: 230, alinhar: "center" });
  texto("Assinatura da funcionária", X, ya + 19, { tam: 7.5, cor: COR.tinta3, largura: 230, alinhar: "center" });
  texto(d.empresa.nome, X + L - 230, ya + 6, { fonte: "medio", tam: 9, largura: 230, alinhar: "center" });
  texto("Gestora", X + L - 230, ya + 19, { tam: 7.5, cor: COR.tinta3, largura: 230, alinhar: "center" });

  texto(`Gerado em ${quando(d.geradoEm ?? new Date())} · ${d.empresa.nome} · sistema ${d.versao}`, X, 800, { tam: 7, cor: COR.tinta3, largura: L, alinhar: "center" });

  doc.end();
  return pronto;
}

export function nomeArquivoEspelho(nome: string, segunda: string): string {
  const br = (s: string) => dataBr(s).replaceAll("/", "-");
  return `Espelho - ${nome} - ${br(segunda)} a ${br(somarDias(segunda, 4))}.pdf`.replace(/[\\/:*?"<>|]/g, "_");
}
