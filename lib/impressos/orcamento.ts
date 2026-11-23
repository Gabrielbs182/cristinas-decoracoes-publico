/**
 * Orçamento em PDF (A4, quantas páginas precisar). Mesmo visual do espelho de ponto: Jost nos títulos,
 * Manrope no texto, terracota como acento. A tabela de cada ambiente quebra de página repetindo o cabeçalho.
 */
import path from "node:path";

import PDFDocument from "pdfkit";

import { dataSP, type DocumentoOrcamento, textoValidade } from "@/lib/vendas/documento";
import { brl } from "@/lib/vendas/numeros";

const COR = {
  tinta: "#2B2421",
  tinta2: "#4A403A",
  tinta3: "#6E635B",
  borda: "#E5DDD1",
  trilho: "#EFE8DD",
  suave: "#FAF7F2",
  terracota: "#A04A2A",
  terracotaClaro: "#F5E5DB",
  perigo: "#B0263A",
  sucesso: "#2E6E47",
};

const FONTES = path.join(process.cwd(), "node_modules", "@fontsource");
const LOGO = path.join(process.cwd(), "public", "logo-circulo.png");
const numero = (n: number) => String(n).padStart(4, "0");

export function gerarOrcamentoPdf(d: DocumentoOrcamento, versao: string): Promise<Buffer> {
  const empresa = d.empresa?.nome || "Cristina's Decorações";
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, left: 40, right: 40, bottom: 16 },
    bufferPages: true, // para numerar as páginas no fim
    info: { Title: `Orçamento nº ${numero(d.numero)} · ${d.cliente.nome}`, Author: empresa, Creator: `Sistema ${empresa} ${versao}` },
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
  const L = 515;
  const FIM = 770; // abaixo disso só o rodapé
  type Op = { fonte?: string; tam?: number; cor?: string; largura?: number; alinhar?: "left" | "right" | "center"; espaco?: number };
  const texto = (s: string, x: number, y: number, o: Op = {}) => {
    doc
      .font(o.fonte ?? "corpo")
      .fontSize(o.tam ?? 10)
      .fillColor(o.cor ?? COR.tinta)
      .text(s, x, y, { width: o.largura, align: o.alinhar ?? "left", lineBreak: !!o.largura && o.alinhar !== "right", characterSpacing: o.espaco ?? 0 });
  };
  const altura = (s: string, largura: number, fonte = "corpo", tam = 10) => doc.font(fonte).fontSize(tam).heightOfString(s, { width: largura });
  const linha = (y: number, cor = COR.trilho) => doc.moveTo(X, y).lineTo(X + L, y).lineWidth(0.8).strokeColor(cor).stroke();

  // ---------------------------------------------------------------- cabeçalho
  doc.image(LOGO, X, 34, { width: 58, height: 58 });
  texto(empresa, X + 70, 42, { fonte: "titulo", tam: 17 });
  const e = d.empresa;
  const contato1 = [e?.razao_social, e?.cnpj && `CNPJ ${e.cnpj}`].filter(Boolean).join(" · ");
  const contato2 = [e?.telefone, e?.email].filter(Boolean).join(" · ");
  const contato3 = [e?.endereco, e?.cidade_uf].filter(Boolean).join(" — ");
  let yc = 63;
  for (const c of [contato1, contato2, contato3].filter(Boolean)) {
    texto(c, X + 70, yc, { tam: 7.5, cor: COR.tinta3, largura: 270 });
    yc += 10;
  }

  const rascunho = d.status === "rascunho" || d.status === "cancelado";
  texto(rascunho ? (d.status === "cancelado" ? "ORÇAMENTO CANCELADO" : "RASCUNHO · NÃO ENVIADO") : "ORÇAMENTO", X + L - 220, 38, {
    fonte: "forte",
    tam: 8,
    cor: rascunho ? COR.perigo : COR.terracota,
    largura: 220,
    alinhar: "right",
    espaco: 1.2,
  });
  texto(`Nº ${numero(d.numero)}`, X + L - 220, 50, { fonte: "titulo", tam: 22, largura: 220, alinhar: "right" });
  texto(`Emitido em ${dataSP(d.enviado_em ?? d.criado_em)}`, X + L - 220, 78, { tam: 8, cor: COR.tinta3, largura: 220, alinhar: "right" });
  texto(textoValidade(d), X + L - 220, 89, { fonte: "medio", tam: 8, cor: d.vencido ? COR.perigo : COR.tinta2, largura: 220, alinhar: "right" });
  linha(108, COR.borda);

  // ---------------------------------------------------------------- cliente
  texto("CLIENTE", X, 120, { fonte: "forte", tam: 7.5, cor: COR.tinta3, espaco: 0.8 });
  texto(d.cliente.nome, X, 131, { fonte: "titulo", tam: 16, largura: 300 });
  if (d.cliente.telefone) texto(d.cliente.telefone, X, 152, { tam: 9, cor: COR.tinta2 });
  texto("ENDEREÇO DA OBRA", X + 315, 120, { fonte: "forte", tam: 7.5, cor: COR.tinta3, espaco: 0.8 });
  texto(d.endereco_obra || "—", X + 315, 132, { tam: 9, largura: 200 });
  if (d.vendedora) texto(`Atendimento: ${d.vendedora}`, X + 315, 160, { tam: 8, cor: COR.tinta3, largura: 200 });
  let y = 182;

  // ---------------------------------------------------------------- ambientes
  const C = { desc: 300, qtd: 45, unit: 85, total: 85 };
  const cabecalhoTabela = () => {
    doc.rect(X, y, L, 18).fill(COR.suave);
    texto("ITEM", X + 8, y + 5.5, { fonte: "forte", tam: 7, cor: COR.tinta3, espaco: 0.4 });
    texto("QTD.", X + C.desc, y + 5.5, { fonte: "forte", tam: 7, cor: COR.tinta3, largura: C.qtd, alinhar: "right" });
    texto("UNITÁRIO", X + C.desc + C.qtd, y + 5.5, { fonte: "forte", tam: 7, cor: COR.tinta3, largura: C.unit, alinhar: "right" });
    texto("TOTAL", X + C.desc + C.qtd + C.unit, y + 5.5, { fonte: "forte", tam: 7, cor: COR.tinta3, largura: C.total - 8, alinhar: "right" });
    y += 18;
  };
  const novaPagina = () => {
    doc.addPage();
    y = 40;
  };

  for (const a of d.ambientes) {
    if (!a.itens.length) continue;
    if (y > FIM - 70) novaPagina();
    const sub = a.itens.reduce((t, i) => t + i.total_centavos, 0);
    texto(a.nome, X, y, { fonte: "titulo", tam: 13 });
    texto(brl(sub), X + L - 150, y + 2, { fonte: "forte", tam: 10, largura: 150, alinhar: "right" });
    y += 20;
    cabecalhoTabela();
    for (const i of a.itens) {
      const h = Math.max(22, altura(i.descricao, C.desc - 16, "medio", 9) + (i.medidas ? 12 : 0) + 10);
      if (y + h > FIM) {
        novaPagina();
        texto(`${a.nome} (continuação)`, X, y, { fonte: "titulo", tam: 11, cor: COR.tinta3 });
        y += 18;
        cabecalhoTabela();
      }
      texto(i.descricao, X + 8, y + 5, { fonte: "medio", tam: 9, largura: C.desc - 16 });
      if (i.medidas) texto(`Medidas: ${i.medidas}`, X + 8, y + 5 + altura(i.descricao, C.desc - 16, "medio", 9) + 1, { tam: 7.5, cor: COR.tinta3 });
      texto(String(i.quantidade), X + C.desc, y + 5, { tam: 9, largura: C.qtd, alinhar: "right" });
      texto(brl(i.unitario_centavos), X + C.desc + C.qtd, y + 5, { tam: 9, largura: C.unit, alinhar: "right" });
      texto(brl(i.total_centavos), X + C.desc + C.qtd + C.unit, y + 5, { fonte: "forte", tam: 9, largura: C.total - 8, alinhar: "right" });
      y += h;
      linha(y);
    }
    y += 14;
  }

  // ---------------------------------------------------------------- totais
  const linhasTotal: [string, string][] = [["Subtotal", brl(d.subtotal_centavos)]];
  if (d.desconto_centavos) linhasTotal.push(["Desconto", `− ${brl(d.desconto_centavos)}`]);
  if (d.deslocamento_centavos) linhasTotal.push(["Taxa de deslocamento", brl(d.deslocamento_centavos)]);
  const alturaTotais = linhasTotal.length * 15 + 40;
  if (y + alturaTotais > FIM) novaPagina();
  const xT = X + L - 230;
  for (const [r, v] of linhasTotal) {
    texto(r, xT, y, { tam: 9, cor: COR.tinta2 });
    texto(v, xT, y, { tam: 9, largura: 222, alinhar: "right" });
    y += 15;
  }
  doc.roundedRect(xT - 8, y + 2, 238, 32, 6).fill(COR.terracotaClaro);
  texto("TOTAL", xT, y + 13, { fonte: "forte", tam: 9, cor: COR.terracota, espaco: 0.8 });
  texto(brl(d.total_centavos), xT, y + 9, { fonte: "titulo", tam: 16, largura: 222, alinhar: "right" });
  y += 50;

  // ---------------------------------------------------------------- condições e observações
  const blocos: [string, string][] = [
    ["CONDIÇÕES DE PAGAMENTO", d.condicoes_pagamento],
    ["PRAZO DE ENTREGA", d.prazo_entrega],
    ["VALIDADE", textoValidade(d)],
    ["OBSERVAÇÕES", d.obs_cliente],
  ];
  for (const [r, v] of blocos) {
    if (!v) continue;
    const h = 12 + altura(v, L, "corpo", 9) + 10;
    if (y + h > FIM) novaPagina();
    texto(r, X, y, { fonte: "forte", tam: 7.5, cor: COR.tinta3, espaco: 0.8 });
    texto(v, X, y + 12, { tam: 9, largura: L });
    y += h;
  }

  // ---------------------------------------------------------------- aceite
  if (y + 70 > FIM) novaPagina();
  y = Math.max(y + 16, Math.min(FIM - 60, y + 30));
  if (d.status === "aprovado" && d.respondido_em) {
    doc.roundedRect(X, y, L, 34, 6).fill("#E3F0E7");
    texto(`Aprovado ${d.aprovado_pelo_link ? "pela cliente pelo link" : ""} em ${dataSP(d.respondido_em)}.`, X + 12, y + 12, { fonte: "forte", tam: 10, cor: COR.sucesso });
  } else {
    doc.moveTo(X, y + 30).lineTo(X + 280, y + 30).lineWidth(0.8).strokeColor(COR.tinta3).stroke();
    texto(`De acordo — ${d.cliente.nome}`, X, y + 35, { tam: 8, cor: COR.tinta3, largura: 280 });
    doc.moveTo(X + 330, y + 30).lineTo(X + L, y + 30).lineWidth(0.8).strokeColor(COR.tinta3).stroke();
    texto("Data", X + 330, y + 35, { tam: 8, cor: COR.tinta3 });
  }

  // ---------------------------------------------------------------- rodapé paginado
  const { count } = doc.bufferedPageRange();
  for (let p = 0; p < count; p++) {
    doc.switchToPage(p);
    texto(`Orçamento nº ${numero(d.numero)} · ${empresa} · página ${p + 1} de ${count}`, X, 806, { tam: 7, cor: COR.tinta3, largura: L, alinhar: "center" });
  }
  doc.end();
  return pronto;
}

