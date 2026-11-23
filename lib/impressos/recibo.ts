/**
 * Recibo em PDF: meia folha A4. Com duas vias, a mesma folha leva a via do cliente em cima e a da empresa
 * embaixo, separadas por linha de corte. Recibo cancelado sai carimbado.
 */
import path from "node:path";

import PDFDocument from "pdfkit";

import { valorPorExtenso } from "@/lib/vendas/extenso";
import { brl } from "@/lib/vendas/numeros";
import { cidadeDoRecibo, dataPorExtenso, type FormaPagamento, numeroRecibo, ROTULO_FORMA } from "@/lib/vendas/recibos";

export interface DocumentoRecibo {
  numero: number;
  valor_centavos: number;
  pagador: string;
  referente: string;
  forma: FormaPagamento;
  data_pagamento: string;
  status: "emitido" | "cancelado";
  cancelado_em: string | null;
  motivo_cancelamento: string;
  empresa: { nome: string; razao_social: string; cnpj: string; telefone: string; cidade_uf: string };
}

const COR = { tinta: "#2B2421", tinta2: "#4A403A", tinta3: "#6E635B", borda: "#E5DDD1", terracota: "#A04A2A", terracotaClaro: "#F5E5DB", perigo: "#B0263A" };
const FONTES = path.join(process.cwd(), "node_modules", "@fontsource");
const LOGO = path.join(process.cwd(), "public", "logo-circulo.png");

export function nomeArquivoRecibo(numero: number) {
  return `Recibo-${numeroRecibo(numero)}.pdf`;
}

export function gerarReciboPdf(d: DocumentoRecibo, vias: 1 | 2, versao: string): Promise<Buffer> {
  const empresa = d.empresa.nome || "Cristina's Decorações";
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 0, left: 40, right: 40, bottom: 0 },
    info: { Title: `Recibo nº ${numeroRecibo(d.numero)} · ${d.pagador}`, Author: empresa, Creator: `Sistema ${empresa} ${versao}` },
  });
  doc.registerFont("corpo", path.join(FONTES, "manrope/files/manrope-latin-400-normal.woff"));
  doc.registerFont("forte", path.join(FONTES, "manrope/files/manrope-latin-700-normal.woff"));
  doc.registerFont("titulo", path.join(FONTES, "jost/files/jost-latin-400-normal.woff"));

  const pedacos: Buffer[] = [];
  doc.on("data", (c: Buffer) => pedacos.push(c));
  const pronto = new Promise<Buffer>((ok, erro) => {
    doc.on("end", () => ok(Buffer.concat(pedacos)));
    doc.on("error", erro);
  });

  const X = 40;
  const L = 515;
  const METADE = 421;
  const cidade = cidadeDoRecibo(d.empresa.cidade_uf);
  const contato = [d.empresa.razao_social, d.empresa.cnpj && `CNPJ ${d.empresa.cnpj}`, d.empresa.telefone].filter(Boolean).join(" · ");
  const extenso = valorPorExtenso(d.valor_centavos);

  const via = (y0: number, rotulo: string | null) => {
    doc.image(LOGO, X, y0 + 30, { width: 46, height: 46 });
    doc.font("titulo").fontSize(15).fillColor(COR.tinta).text(empresa, X + 56, y0 + 34, { width: 260, lineBreak: false });
    if (contato) doc.font("corpo").fontSize(7.5).fillColor(COR.tinta3).text(contato, X + 56, y0 + 55, { width: 270 });

    doc.font("forte").fontSize(9).fillColor(COR.terracota).text(`RECIBO Nº ${numeroRecibo(d.numero)}`, X + L - 200, y0 + 30, { width: 200, align: "right", characterSpacing: 1 });
    doc.roundedRect(X + L - 180, y0 + 46, 180, 32, 6).fill(COR.terracotaClaro);
    doc.font("titulo").fontSize(17).fillColor(COR.tinta).text(brl(d.valor_centavos), X + L - 180, y0 + 53, { width: 168, align: "right" });
    doc.moveTo(X, y0 + 96).lineTo(X + L, y0 + 96).lineWidth(0.8).strokeColor(COR.borda).stroke();

    // Corpo: negrito no nome, no valor por extenso.
    doc.font("corpo").fontSize(11.5).fillColor(COR.tinta).text("Recebi de ", X, y0 + 116, { width: L, continued: true, lineGap: 4 });
    doc.font("forte").text(d.pagador, { continued: true });
    doc.font("corpo").text(" a importância de ", { continued: true });
    doc.font("forte").text(extenso, { continued: true });
    doc.font("corpo").text(`, referente ${d.referente}.`);
    doc.moveDown(0.8);
    doc.font("corpo").fontSize(10).fillColor(COR.tinta2).text(`Forma de pagamento: ${ROTULO_FORMA[d.forma]}`, X, doc.y, { width: L });

    const data = `${cidade ? `${cidade}, ` : ""}${dataPorExtenso(d.data_pagamento)}.`;
    doc.font("corpo").fontSize(10).fillColor(COR.tinta).text(data, X, y0 + 292, { width: L, align: "right" });
    doc.moveTo(X + L - 250, y0 + 344).lineTo(X + L, y0 + 344).lineWidth(0.8).strokeColor(COR.tinta3).stroke();
    doc.font("corpo").fontSize(8.5).fillColor(COR.tinta3).text([d.empresa.razao_social, empresa].filter(Boolean).join(" · "), X + L - 250, y0 + 350, { width: 250, align: "center" });
    if (rotulo) doc.font("forte").fontSize(7).fillColor(COR.tinta3).text(rotulo.toUpperCase(), X, y0 + 356, { characterSpacing: 1 });

    if (d.status === "cancelado") {
      doc.save();
      doc.rotate(-18, { origin: [X + L / 2, y0 + 200] });
      doc.font("forte").fontSize(54).fillColor(COR.perigo).fillOpacity(0.18).text("CANCELADO", X, y0 + 170, { width: L, align: "center" });
      doc.restore();
      doc.fillOpacity(1);
      const quando = d.cancelado_em ? new Date(d.cancelado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
      doc.font("forte").fontSize(8.5).fillColor(COR.perigo).text(`Cancelado em ${quando}: ${d.motivo_cancelamento}`, X, y0 + 374, { width: L });
    }
  };

  if (vias === 2) {
    via(0, "Via do cliente");
    doc.moveTo(X, METADE).lineTo(X + L, METADE).lineWidth(0.8).dash(4, { space: 4 }).strokeColor(COR.tinta3).stroke().undash();
    doc.rect(X + L / 2 - 40, METADE - 6, 80, 12).fill("#FFFFFF");
    doc.font("corpo").fontSize(7).fillColor(COR.tinta3).text("corte aqui", X + L / 2 - 40, METADE - 4, { width: 80, align: "center" });
    via(METADE, "Via da empresa");
  } else {
    via(0, null);
  }
  doc.end();
  return pronto;
}
