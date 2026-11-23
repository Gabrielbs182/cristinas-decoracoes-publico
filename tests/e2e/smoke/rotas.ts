/**
 * Matriz de acesso do smoke: TODA tela (app/**\/page.tsx) e todo arquivo (app/**\/route.ts) com o que cada papel
 * deve ver. Tela ou rota nova sem entrada aqui reprova o smoke, de propósito: decidir quem abre é parte de criar.
 */
import { readdirSync } from "node:fs";
import path from "node:path";

export const PAPEIS = ["anonimo", "gestora", "contador", "funcionaria"] as const;
export type Papel = (typeof PAPEIS)[number];

/** abre = a tela carrega naquele endereço; login / negado = vai para /login ou /sem-permissao; "/x" = redireciona para /x. */
export type Destino = "abre" | "login" | "negado" | `/${string}`;
type Acesso = Record<Papel, Destino>;

const SO_GESTORA: Acesso = { anonimo: "login", gestora: "abre", contador: "negado", funcionaria: "negado" };
const GESTAO: Acesso = { anonimo: "login", gestora: "abre", contador: "abre", funcionaria: "negado" };
const PORTAL: Acesso = { anonimo: "login", gestora: "negado", contador: "negado", funcionaria: "abre" };
const LOGADO: Acesso = { anonimo: "login", gestora: "abre", contador: "abre", funcionaria: "abre" };
const PUBLICA: Acesso = { anonimo: "abre", gestora: "abre", contador: "abre", funcionaria: "abre" };
const INICIO = { gestora: "/inicio", contador: "/rh/semanas", funcionaria: "/meu-ponto" } as const;

export const TELAS: Record<string, Acesso> = {
  "/": { anonimo: "login", ...INICIO },
  "/login": { anonimo: "abre", ...INICIO },
  // Segunda etapa do login: só abre para quem entrou com a senha e ligou a verificação (o smoke entra sem ela).
  "/login/codigo": { anonimo: "login", ...INICIO },
  "/auth/confirmar": PUBLICA,
  "/o/[token]": PUBLICA,
  "/definir-senha": LOGADO,
  "/sem-permissao": LOGADO,

  "/inicio": SO_GESTORA,
  "/ponto/importar": SO_GESTORA,
  "/ponto/semana": SO_GESTORA,
  "/ponto/pendencias": SO_GESTORA,
  "/ponto/solicitacoes": SO_GESTORA,
  "/ponto/banco": SO_GESTORA,
  "/ponto/fechamento": SO_GESTORA,
  "/ponto/equipe": SO_GESTORA,
  "/ponto/calendario": SO_GESTORA,
  "/clientes": SO_GESTORA,
  "/clientes/[id]": SO_GESTORA,
  "/catalogo": SO_GESTORA,
  "/orcamentos": SO_GESTORA,
  "/orcamentos/[id]": SO_GESTORA,
  "/recibos/novo": SO_GESTORA,
  "/configuracoes": SO_GESTORA,

  "/rh/semanas": GESTAO,
  "/rh/semanas/[segunda]": GESTAO,
  "/rh/banco": GESTAO,
  "/recibos": GESTAO,
  "/recibos/[id]": GESTAO,
  "/conta": GESTAO,
  "/versao": GESTAO,
  "/ajuda": GESTAO,

  "/meu-ponto": PORTAL,
  "/meu-ponto/pendencias": PORTAL,
  "/meu-ponto/corrigir": PORTAL,
  "/meu-ponto/solicitacoes": PORTAL,
  "/meu-ponto/banco": PORTAL,
  "/meu-ponto/espelhos": PORTAL,
  "/meu-ponto/perfil": PORTAL,
  "/meu-ponto/ajuda": PORTAL,
};

/** Status HTTP esperado de cada arquivo (sem login, o proxy manda para o login antes de a rota responder). */
export type Resposta = number | "login";
export const ARQUIVOS: Record<string, Record<Papel, Resposta> | "regressao"> = {
  "/arquivos/orcamento/[id]": { anonimo: "login", gestora: 200, contador: 403, funcionaria: 403 },
  "/arquivos/recibo/[id]": { anonimo: "login", gestora: 200, contador: 200, funcionaria: 403 },
  "/arquivos/recibos": { anonimo: "login", gestora: 200, contador: 200, funcionaria: 403 },
  "/arquivos/planilha/[segunda]": { anonimo: "login", gestora: 200, contador: 200, funcionaria: 403 },
  // A funcionária do smoke não é a dona do espelho escolhido: o Storage responde como se não existisse.
  "/arquivos/espelho/[segunda]/[funcionaria]": { anonimo: "login", gestora: 200, contador: 200, funcionaria: 404 },
  "/o/[token]/pdf": { anonimo: 200, gestora: 200, contador: 200, funcionaria: 200 },
  // Monitoramento da VPS: sem login, só diz se o app alcança o Supabase.
  "/api/saude": { anonimo: 200, gestora: 200, contador: 200, funcionaria: 200 },
  // Modelo do e-mail de senha nova, que o Auth da VPS busca por http: público e sem dado nenhum.
  "/modelos/recuperar-senha": { anonimo: 200, gestora: 200, contador: 200, funcionaria: 200 },
  // Anexo de pedido de correção: precisa de upload pelo portal; coberto em regressao/01-portal (dona, colega, contador).
  "/arquivos/anexo/[...caminho]": "regressao",
};

/** Endereços de app/**\/page.tsx e app/**\/route.ts, sem os grupos "(gestao)". */
export function descobrir(arquivo: "page.tsx" | "route.ts", pasta = "app", partes: string[] = []): string[] {
  const achados: string[] = [];
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    if (item.isDirectory()) {
      const parte = /^\(.*\)$/.test(item.name) ? [] : [item.name];
      achados.push(...descobrir(arquivo, path.join(pasta, item.name), [...partes, ...parte]));
    } else if (item.name === arquivo) {
      achados.push(`/${partes.join("/")}`);
    }
  }
  return achados.sort();
}
