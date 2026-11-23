import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em toda resposta: nenhuma página entra em moldura de outro site (clickjacking), o
 * navegador não adivinha tipo de arquivo, o endereço com token (/o/…) não vaza como Referer para fora.
 * HSTS só com APP_URL em https (na VPS); em http o navegador o ignora e atrapalharia o teste local.
 */
const CABECALHOS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=(), usb=()" },
  ...(process.env.APP_URL?.startsWith("https://") ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: CABECALHOS }],
  // Em dev o app é aberto por 127.0.0.1 (o cookie da sessão é gravado para essa origem).
  allowedDevOrigins: ["127.0.0.1"],
  // O indicador de dev do Next ficava em cima do usuário/“Sair” no rodapé do menu.
  devIndicators: { position: "bottom-right" },
  // Produção (VPS e ambiente de teste): servidor enxuto em .next/standalone, sem node_modules inteiro.
  output: "standalone",
  // pdfkit lê fontes e métricas do disco em tempo de execução: fica fora do bundle.
  serverExternalPackages: ["pdfkit", "exceljs"],
  // Lidos por caminho (process.cwd()) em tempo de execução — fontes do PDF e o modelo do e-mail de senha nova: o
  // rastreio do build não os acha sozinho.
  outputFileTracingIncludes: {
    "/**": [
      "node_modules/@fontsource/manrope/files/manrope-latin-{400,600,700}-normal.woff",
      "node_modules/@fontsource/jost/files/jost-latin-400-normal.woff",
      "node_modules/pdfkit/js/data/**/*",
      "supabase/templates/*.html",
    ],
  },
  // Server Actions recebem o arquivo da catraca e o anexo do pedido (foto reduzida no celular; PDF até 10 MB).
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
