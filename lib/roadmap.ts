/**
 * Roadmap até a 1.0 — fonte única. A tela /versao e o ROADMAP.md (npm run roadmap) saem daqui.
 *
 * Ao lançar uma versão: marque as entregas como feitas, mude o status para "lancada" com a data,
 * suba o "version" do package.json para o mesmo número e rode `npm run roadmap`.
 * O teste tests/unit/roadmap.test.ts recusa versão do package.json diferente da última lançada
 * e ROADMAP.md desatualizado.
 *
 * `entregas` é linguagem de quem usa (aparece na tela); `tecnico` só vai para o ROADMAP.md.
 */

export type StatusVersao = "lancada" | "proxima" | "planejada";

export interface Entrega {
  texto: string;
  feito: boolean;
}

export interface Versao {
  versao: string;
  titulo: string;
  status: StatusVersao;
  /** YYYY-MM-DD, só nas lançadas. */
  data?: string;
  objetivo: string;
  entregas: Entrega[];
  tecnico: string[];
}

const feito = (texto: string): Entrega => ({ texto, feito: true });
const falta = (texto: string): Entrega => ({ texto, feito: false });

export const ROADMAP: Versao[] = [
  {
    versao: "0.1.0",
    titulo: "Fundação",
    status: "lancada",
    data: "2026-10-17",
    objetivo: "Base segura do sistema e o motor de ponto que valida em vez de só somar.",
    entregas: [
      feito("Login por usuário ou e-mail, com perfil de gestora, funcionária ou contador"),
      feito("Cada perfil vê só o que pode, controlado no próprio banco de dados"),
      feito("Batida da catraca nunca é apagada nem alterada; toda correção fica registrada com motivo"),
      feito("Cálculo de horas idêntico ao sistema antigo, conferido com os arquivos reais da catraca"),
      feito("Validação: aponta batida faltando, atraso, almoço curto e outros casos, com sugestão de correção"),
    ],
    tecnico: [
      "Next.js 16 + Supabase local (portas 553xx); fontes e componentes sem dependência de rede externa",
      "Migração núcleo + ponto: RLS em todas as tabelas, GRANT explícito, TRUNCATE revogado, anon sem acesso",
      "Diário `ponto_lancamentos` append-only e batida imutável por trigger; semana fechada travada por trigger",
      "Motor `lib/ponto`: conta posicional = legado (paridade 50/50 dias reais) separada da validação",
      "Testes: unidade do motor + matriz de RLS em transação com rollback",
    ],
  },
  {
    versao: "0.2.0",
    titulo: "Ponto no dia a dia",
    status: "lancada",
    data: "2026-10-17",
    objetivo: "A gestora importa o arquivo da catraca, revisa a semana e resolve as pendências.",
    entregas: [
      feito("Importar o arquivo da catraca com prévia antes de gravar, sem duplicar batidas"),
      feito("Tela Semana com as horas de cada funcionária e o banco de horas"),
      feito("Detalhe do dia com linha do tempo, ajustes, desfazer e histórico de quem mudou o quê"),
      feito("Fila de pendências: aceitar sugestão, justificar, marcar falta e vincular ID desconhecido"),
      feito("Início da gestora e portal da funcionária para consultar o próprio ponto"),
    ],
    tecnico: [
      "Server actions recalculam o dia antes de gravar e recusam sugestão desatualizada",
      "Importação em duas etapas (prévia/confirmação), paginada e idempotente por (EnNo, data, hora)",
      "Verificação no navegador (Playwright) com os três perfis e largura de celular",
    ],
  },
  {
    versao: "0.3.0",
    titulo: "Histórico e banco de horas",
    status: "lancada",
    data: "2026-10-17",
    objetivo: "Tudo o que o sistema antigo já apurou, dentro do sistema novo, com o saldo atual certo.",
    entregas: [
      feito("34 semanas do sistema antigo (02/02 a 21/09/2026) importadas, iguais aos relatórios"),
      feito("Saldo atual do banco de horas igual ao do sistema antigo"),
      feito("Tela Banco de horas com gráfico, semana a semana, dias pagos e ajustes"),
      feito("Contador: semanas fechadas, espelho de cada semana e saldos, só leitura"),
      feito("Cadastro com os nomes reais das funcionárias"),
      feito("Versão do sistema e este roadmap visíveis dentro do sistema"),
    ],
    tecnico: [
      "`scripts/importar-historico.ts`: confere 100% contra as planilhas, grava e reconfere do banco",
      "Quebra de saldo do legado vira `ajustes_saldo` com motivo; pendências antigas viram 'apurado na época'",
      "Regra do motor: tipo escolhido pela gestora impede a unificação automática de duplicadas",
      "Versionamento: package.json + lib/roadmap.ts (fonte única) + teste de consistência",
    ],
  },
  {
    versao: "0.4.0",
    titulo: "Fechamento da semana",
    status: "lancada",
    data: "2026-10-17",
    objetivo: "Fechar a semana pelo sistema, com espelho e planilha, sem precisar do programa antigo.",
    entregas: [
      feito("Fechar a semana pela tela, com checklist e confirmação"),
      feito("Reabrir uma semana fechada (só a gestora, com motivo)"),
      feito("Espelho de ponto em PDF de cada funcionária, com espaço para assinatura"),
      feito("Planilha .xlsx da semana no mesmo layout de hoje"),
      feito("Os espelhos em PDF do sistema antigo anexados às semanas do histórico"),
      feito("Ajuste manual de saldo pela tela, sempre com motivo"),
      feito("Contador baixa espelhos e planilhas; a funcionária, só o próprio espelho"),
    ],
    tecnico: [
      "RPC atômica `fechar_semana`/`reabrir_semana`: só a gestora, ordem cronológica, só a última fechada reabre",
      "Storage `espelhos` com RLS por pasta da funcionária; downloads lidos com a sessão de quem pede",
      "PDF (pdfkit, fontes Manrope/Jost embutidas, uma página garantida por teste) e xlsx (exceljs)",
      "Planilha conferida célula a célula contra as 34 originais: só diferem feriados (Falta → Feriado) e a cor de 2 dias justificados",
      "Histórico: dias anotados à mão como \"Justificado\" viram ocorrência de falta justificada",
      "Fluxo completo verificado no navegador (importar → ajustar saldo → fechar → baixar → acessos → reabrir)",
    ],
  },
  {
    versao: "0.5.0",
    titulo: "Portal da funcionária e pedidos de correção",
    status: "lancada",
    data: "2026-10-18",
    objetivo: "A funcionária resolve as pendências dela pelo celular e a gestora só aprova.",
    entregas: [
      feito("Pedir correção de batida pelo celular, com motivo e foto do atestado"),
      feito("Minhas pendências, minhas solicitações, meu banco de horas e meus espelhos no celular"),
      feito("Fila de solicitações da gestora: aprovar vira ajuste, recusar exige resposta"),
      feito("Resolver várias pendências iguais de uma vez"),
    ],
    tecnico: [
      "RPC atômica `aprovar_solicitacao`: só a gestora, só pedido pendente, e o lançamento tem que ser exatamente o pedido",
      "Pedido só de dia que já passou e de semana aberta, sem repetir o mesmo pedido; anexo só na pasta da própria funcionária",
      "Storage `anexos` com RLS: a funcionária envia e lê o dela, a gestora lê tudo, o contador não vê (dado de saúde); ninguém apaga pela API",
      "Foto reduzida no celular antes do envio (lado maior 1600 px, JPEG)",
      "Fluxo completo verificado no navegador (pedido com foto → aprovar/recusar → lote → resposta no celular)",
    ],
  },
  {
    versao: "0.6.0",
    titulo: "Equipe, acessos e regras",
    status: "lancada",
    data: "2026-10-18",
    objetivo: "A gestora administra pessoas, acessos e regras sem depender de ninguém.",
    entregas: [
      feito("Cadastrar, editar e desligar funcionárias (ID da catraca e jornada)"),
      feito("Cada funcionária vira usuária do sistema: a gestora vincula a funcionária da catraca ao usuário dela"),
      feito("O nome que aparece em todo o sistema é o que a própria funcionária configura no perfil"),
      feito("Criar acesso e mandar o convite pelo WhatsApp; redefinir senha; bloquear"),
      feito("Feriados municipais, pontes e pontos facultativos"),
      feito("Regras de jornada editáveis, valendo a partir da próxima semana aberta"),
      feito("Configurações: dados da empresa, usuários e perfis"),
    ],
    tecnico: [
      "Link de senha (uso único, 24 h) validado só quando a pessoa envia a senha: a prévia do WhatsApp abre o link e não pode gastá-lo",
      "Login pela API de admin só no servidor; o perfil é criado com a sessão da gestora (`criar_perfil`); bloqueio no perfil e no Auth",
      "Nome: `alterar_meu_nome` muda perfil e cadastro juntos; com acesso ativo, a gestora não muda o nome dela (trigger)",
      "`definir_regras` grava a versão a partir da primeira semana não fechada; feriado de semana fechada travado no banco; sempre fica uma gestora com acesso",
      "Funcionária desligada continua nas semanas em que trabalhou (não some do fechamento)",
      "Fluxo completo verificado no navegador (cadastro → acesso → senha pelo link → nome → bloqueio → desligamento → regras)",
    ],
  },
  {
    versao: "0.7.0",
    titulo: "Clientes e catálogo",
    status: "lancada",
    data: "2026-10-24",
    objetivo: "A base para orçar: quem compra e o que se vende, com preço.",
    entregas: [
      feito("Cadastro de clientes com residência e endereço da obra"),
      feito("Catálogo de tecidos, persianas, trilhos, acessórios e serviços com preço"),
      feito("Regras de cálculo configuráveis (franzimento, sobra de trilho, área mínima)"),
    ],
    tecnico: [
      "Tabelas de vendas com RLS só da gestora (contador e funcionária não veem cliente nem preço)",
      "Dinheiro em centavos e medidas em centímetros, inteiros do banco à tela (sem erro de arredondamento)",
      "Unidade amarrada à categoria no banco; produto não se apaga (inativa); nome único por categoria",
      "Motor de cálculo puro com testes (tecido × franzimento, área mínima, sobra de trilho), pronto para o editor da 0.8",
      "Rótulo e dica dos formulários ligados por htmlFor/aria-describedby (a dica não entra mais no nome do campo)",
      "Fluxo completo verificado no navegador (clientes, catálogo, regras, acessos, celular)",
    ],
  },
  {
    versao: "0.8.0",
    titulo: "Orçamentos",
    status: "lancada",
    data: "2026-10-24",
    objetivo: "Montar, enviar e acompanhar orçamentos de cortinas e persianas.",
    entregas: [
      feito("Editor por ambiente com cálculo automático e memória de cálculo visível"),
      feito("Versão de celular para lançar as medidas na visita técnica"),
      feito("PDF do orçamento e envio por WhatsApp"),
      feito("Situação do orçamento: rascunho, enviado, aprovado, recusado, vencido"),
      feito("Opcional: página para a cliente aprovar pelo celular"),
    ],
    tecnico: [
      "Numeração sem buraco: contador em tabela travado na transação (sequence pularia número); orçamento não se apaga, rascunho descartado fica cancelado",
      "Preço congelado no item: guarda os preços da época; mudar medida não reprecifica, trocar o produto pega o preço atual",
      "O servidor recalcula tudo com o mesmo motor da tela e grava de uma vez (RPC salvar_orcamento); salvamento automático em ordem",
      "Situação validada no banco: só as transições do fluxo, conteúdo travado fora do rascunho, vencido calculado pela validade",
      "Link da cliente por token aleatório; o anon só executa as duas funções do link; abrir não aprova (a prévia do WhatsApp abre)",
      "Ambiente de teste isolado (Supabase 573xx + app em modo produção) para os testes de navegador não tocarem nos dados reais",
    ],
  },
  {
    versao: "0.9.0",
    titulo: "Recibos",
    status: "lancada",
    data: "2026-10-24",
    objetivo: "Registrar cada pagamento de cliente e saber quanto falta receber.",
    entregas: [
      feito("Emitir recibo de sinal, parcela ou quitação a partir do orçamento, ou avulso"),
      feito("Valor por extenso automático e impressão em meia folha com duas vias"),
      feito("Cancelar com motivo, sem reaproveitar o número"),
      feito("Saldo a receber no Início e exportação para o contador"),
    ],
    tecnico: [
      "Valor do recibo limitado ao saldo do orçamento no banco, com o orçamento travado na transação; quitação só do saldo exato",
      "Recibo emitido não muda; cancelamento com motivo; número sem buraco; orçamento com recibo emitido não desfaz a aprovação",
      "Contador só lê: o recibo guarda o nome de quem pagou e o número do orçamento (ele não vê clientes nem orçamentos)",
      "Valor por extenso em português do Brasil com testes (milhão redondo, \"mil e duzentos\", singular)",
      "Fluxo completo verificado no ambiente de teste (sinal, saldo, quitação, cancelamento, avulso, exportação, contador)",
    ],
  },
  {
    versao: "0.9.1",
    titulo: "Segurança e testes",
    status: "lancada",
    data: "2026-10-24",
    objetivo: "Fechar as brechas achadas na auditoria de segurança e testar todas as telas automaticamente.",
    entregas: [
      feito("Auditoria de segurança do sistema inteiro, com as correções aplicadas"),
      feito("Todas as telas testadas automaticamente com cada tipo de usuário, no computador e no celular"),
      feito("Todo erro encontrado vira um teste que impede que ele volte"),
    ],
    tecnico: [
      "Regressão no navegador (Playwright: portal, equipe, vendas, orçamentos, recibos, segurança) e smoke de telas (todas as rotas × 4 papéis, computador e celular) no ambiente de teste isolado",
      "Agente de QA (`.claude/agents/qa-smoke.md`) e registro de regressões (`tests/REGRESSOES.md`)",
      "Cobertura de RLS e permissões lida do catálogo do banco: tabela, permissão ou função SECURITY DEFINER nova reprova até ser revisada",
      "Next 16.4.3 (DoS sem login em Server Actions), cookie da sessão HttpOnly por 30 dias, cabeçalhos de segurança, volta do login só para dentro do site",
      "Revogados MAINTAIN/TRUNCATE/TRIGGER/REFERENCES/setval que o Postgres 17 do Supabase concede por padrão; pedido de correção validado no banco (anexo, data, duplicado)",
    ],
  },
  {
    versao: "0.10.0",
    titulo: "Pronto para subir",
    status: "lancada",
    data: "2026-10-24",
    objetivo: "Deixar tudo pronto para pôr o sistema no ar: pacote da VPS, cópia de segurança, guia e testes automáticos.",
    entregas: [
      feito("Guia rápido de uso dentro do sistema, para a gestora, o contador e as funcionárias"),
      feito("Cópia de segurança de todos os dados e arquivos, com a restauração ensaiada de ponta a ponta"),
      feito("Testes automáticos a cada mudança (GitHub)"),
      feito("Mais proteção no login: limite de tentativas erradas e troca de senha pedindo a senha atual"),
      feito("Pacote para a VPS: o sistema em container, HTTPS automático e o roteiro de implantação"),
    ],
    tecnico: [
      "Build standalone (fontes do PDF incluídas) e Dockerfile; a regressão e o smoke inteiros passaram contra o container de produção",
      "Supabase self-hosting oficial fixado numa versão, com segredos gerados na VPS e nada exposto além de 80/443 (deploy/)",
      "Empresa, regra de ponto e feriados nacionais até 2030 como migração (o seed.sql não roda em produção)",
      "Fechar e reabrir semana só pelas funções do banco (gatilho recusa gravação direta da gestora)",
      "Cópia: dados de public/auth/storage + arquivos do Storage + contagem por tabela; restauração confere a contagem",
      "/api/saude para o monitoramento e erros do servidor em JSON no log (instrumentation.ts)",
      "Testes usavam a data UTC como \"hoje\": falhavam toda noite depois das 21h (corrigido para o fuso da loja)",
    ],
  },
  {
    versao: "0.11.0",
    titulo: "Decisões aplicadas",
    status: "lancada",
    data: "2026-10-25",
    objetivo: "Pôr em prática as decisões de 25/10/2026 antes de subir.",
    entregas: [
      feito("Verificação em duas etapas opcional (código de um app no celular), para quem quiser"),
      feito("Esqueci minha senha por e-mail, para quem entra com e-mail"),
      feito("Espelho e planilha do contador saem com o nome do cadastro"),
      feito("O link do orçamento para a cliente expira 30 dias depois de vencer"),
    ],
    tecnico: [
      "TOTP do Supabase: login com senha certa leva a /login/codigo e, até o código, a sessão não conta (telas, arquivos e ações recusam)",
      "Redefinir senha (tela e scripts/producao.ts link) também apaga os fatores: a saída de quem perdeu o celular",
      "Modelo do e-mail em supabase/templates (servido pelo app para o Auth da VPS) com o link para /auth/confirmar e type=recovery",
      "Um montador só para o link de senha (lib/link-senha.ts): o script da VPS saía sem type=recovery (\"Link incompleto\")",
      "orcamento_publico devolve só a data de expiração depois de valido_ate + 30 (aprovado continua visível)",
    ],
  },
  {
    versao: "0.11.1",
    titulo: "Ensaio da VPS",
    status: "lancada",
    data: "2026-10-25",
    objetivo: "Ensaiar a subida inteira com o Supabase oficial e deixar o pacote cabendo no KVM 1 (4 GB).",
    entregas: [
      feito("Subida ensaiada de ponta a ponta: banco, sistema, primeira gestora, cópia e restauração"),
      feito("Cabe com folga no plano de 4 GB (~0,5 GB em uso)"),
    ],
    tecnico: [
      "Imagem única para qualquer ambiente (o Supabase é lido quando o servidor sobe), publicada pela CI no ghcr.io a cada tag",
      "Supabase oficial enxuto: só gateway, Postgres, Auth, PostgREST e Storage; Studio sob demanda (perfil painel)",
      "Achados do ensaio: /api/saude usava a raiz /rest/v1/ (bloqueada ao anônimo no gateway oficial); db push falha com TLS (vale migration up com sslmode=disable); o tsconfig pegava o Supabase baixado em deploy/; nome do projeto de produção colidia com o do Supabase CLI local",
    ],
  },
  {
    versao: "1.0.0",
    titulo: "No ar",
    status: "proxima",
    objetivo: "O sistema rodando na VPS, com os dados reais, protegido e com cópia de segurança.",
    entregas: [
      falta("Sistema publicado na VPS com endereço próprio e conexão segura (HTTPS)"),
      falta("Cópia de segurança rodando todo dia na VPS, com uma cópia fora dela"),
      falta("Dados reais migrados: cadastro, histórico e saldos"),
      falta("Aviso automático se o sistema sair do ar"),
      falta("E-mail para recuperação de senha (se for usar)"),
    ],
    tecnico: [
      "Seguir deploy/README.md: preparar.sh (Supabase + segredos), db push, compose do app, producao.ts (gestora e cadastro), importar-historico --gravar, cron do backup.sh",
      "Monitor externo (UptimeRobot ou similar) em /api/saude",
      "Limite de login do Auth alto na VPS: ele só vê o IP do servidor Next; quem limita por pessoa é o app (lib/limite.ts)",
      "MFA para gestora e contador, conforme a decisão",
      "E-mail: modelo de recuperação apontando para /auth/confirmar?token_hash=… (o link padrão vai para o Auth, que não fica na internet)",
      "Ensaiar a restauração na VPS (deploy/backup/restaurar.sh) antes de liberar o uso e a cada atualização do Supabase",
    ],
  },
];

/** Fora do escopo da 1.0 (combinado no início do projeto). */
export const DEPOIS_DA_1_0 = [
  "Agenda de instalação",
  "Estoque",
  "Nota fiscal",
  "Folha de pagamento completa",
  "Contas a pagar",
  "Leitura direta da catraca, sem precisar exportar o arquivo",
];

/** Decisões que dependem do Gabriel/da empresa. Só no ROADMAP.md, não na tela. */
export const DECISOES_EM_ABERTO: string[] = [];

/** Decididas pelo Gabriel (com data). Só no ROADMAP.md. */
export const DECISOES_TOMADAS = [
  "VPS: Hostinger KVM 1 (4 GB, com swap, Supabase enxuto e a imagem montada pela CI), em São Paulo se houver; SEM domínio: o endereço é o nome que a Hostinger dá à VPS (srv….hstgr.cloud), com HTTPS (25/10/2026)",
  "Cópias de segurança fora da VPS: Backblaze B2 (25/10/2026)",
  "Verificação em duas etapas: opcional para todos, cada um liga em Minha conta / Meu perfil (25/10/2026)",
  "Recuperar senha por e-mail: sim, pelo Gmail da loja (SMTP com senha de app), já que sem domínio Resend/Brevo não enviam; o link no WhatsApp continua (25/10/2026)",
  "Documentos oficiais (espelho e planilha) saem com o nome do cadastro; o nome escolhido pela funcionária fica nas telas (25/10/2026)",
  "Link do orçamento para a cliente expira 30 dias depois de vencer (25/10/2026)",
  "Quem está bloqueada continua vendo \"Seu acesso está bloqueado\" (25/10/2026)",
];

export function versaoAtual(): Versao {
  return ROADMAP.filter((v) => v.status === "lancada").at(-1)!;
}

export function progresso() {
  const todas = ROADMAP.flatMap((v) => v.entregas);
  const feitas = todas.filter((e) => e.feito).length;
  return { feitas, total: todas.length, percentual: Math.round((feitas / todas.length) * 100) };
}

const dataBr = (d: string) => d.split("-").reverse().join("/");
const STATUS: Record<StatusVersao, string> = { lancada: "✅ lançada", proxima: "🔜 próxima", planejada: "📋 planejada" };

/** Conteúdo do ROADMAP.md (gerado; não editar o arquivo à mão). */
export function roadmapMarkdown(versaoDoPrograma: string): string {
  const p = progresso();
  const linhas: string[] = [
    "<!-- Gerado por `npm run roadmap` a partir de lib/roadmap.ts. Não edite à mão. -->",
    "",
    "# Roadmap até a 1.0 — Cristina's Decorações",
    "",
    `**Versão atual: ${versaoDoPrograma}** · ${p.feitas} de ${p.total} entregas feitas (${p.percentual}%).`,
    "",
    "Versionamento semântico (`MAJOR.MINOR.PATCH`): cada versão 0.x fecha um bloco de entregas; a 1.0 é o sistema no ar na VPS.",
    "A versão aparece no rodapé do menu e na tela **Versão e novidades** (`/versao`).",
    "",
    "| Versão | Bloco | Situação |",
    "|---|---|---|",
    ...ROADMAP.map((v) => `| ${v.versao} | ${v.titulo} | ${STATUS[v.status]}${v.data ? ` em ${dataBr(v.data)}` : ""} |`),
    "",
  ];
  for (const v of ROADMAP) {
    linhas.push(`## ${v.versao} — ${v.titulo} (${STATUS[v.status]}${v.data ? ` em ${dataBr(v.data)}` : ""})`, "", v.objetivo, "");
    for (const e of v.entregas) linhas.push(`- [${e.feito ? "x" : " "}] ${e.texto}`);
    linhas.push("", "Técnico:", "");
    for (const t of v.tecnico) linhas.push(`- ${t}`);
    linhas.push("");
  }
  linhas.push("## Depois da 1.0", "", ...DEPOIS_DA_1_0.map((d) => `- ${d}`), "");
  linhas.push("## Decisões em aberto", "", ...(DECISOES_EM_ABERTO.length ? DECISOES_EM_ABERTO.map((d) => `- [ ] ${d}`) : ["Nenhuma no momento."]), "");
  linhas.push("## Decisões tomadas", "", ...DECISOES_TOMADAS.map((d) => `- [x] ${d}`), "");
  linhas.push("## Como lançar uma versão", "");
  linhas.push(
    "1. Marque as entregas como feitas em `lib/roadmap.ts` e mude o status para `lancada` com a data.",
    "2. Suba o `version` do `package.json` para o mesmo número.",
    "3. Rode `npm run roadmap` (regera este arquivo) e `npm test` (confere versão e roadmap).",
    "",
  );
  return linhas.join("\n");
}
