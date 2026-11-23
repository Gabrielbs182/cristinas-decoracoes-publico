<!-- Gerado por `npm run roadmap` a partir de lib/roadmap.ts. Não edite à mão. -->

# Roadmap até a 1.0 — Cristina's Decorações

**Versão atual: 0.11.1** · 60 de 65 entregas feitas (92%).

Versionamento semântico (`MAJOR.MINOR.PATCH`): cada versão 0.x fecha um bloco de entregas; a 1.0 é o sistema no ar na VPS.
A versão aparece no rodapé do menu e na tela **Versão e novidades** (`/versao`).

| Versão | Bloco | Situação |
|---|---|---|
| 0.1.0 | Fundação | ✅ lançada em 17/10/2026 |
| 0.2.0 | Ponto no dia a dia | ✅ lançada em 17/10/2026 |
| 0.3.0 | Histórico e banco de horas | ✅ lançada em 17/10/2026 |
| 0.4.0 | Fechamento da semana | ✅ lançada em 17/10/2026 |
| 0.5.0 | Portal da funcionária e pedidos de correção | ✅ lançada em 18/10/2026 |
| 0.6.0 | Equipe, acessos e regras | ✅ lançada em 18/10/2026 |
| 0.7.0 | Clientes e catálogo | ✅ lançada em 24/10/2026 |
| 0.8.0 | Orçamentos | ✅ lançada em 24/10/2026 |
| 0.9.0 | Recibos | ✅ lançada em 24/10/2026 |
| 0.9.1 | Segurança e testes | ✅ lançada em 24/10/2026 |
| 0.10.0 | Pronto para subir | ✅ lançada em 24/10/2026 |
| 0.11.0 | Decisões aplicadas | ✅ lançada em 25/10/2026 |
| 0.11.1 | Ensaio da VPS | ✅ lançada em 25/10/2026 |
| 1.0.0 | No ar | 🔜 próxima |

## 0.1.0 — Fundação (✅ lançada em 17/10/2026)

Base segura do sistema e o motor de ponto que valida em vez de só somar.

- [x] Login por usuário ou e-mail, com perfil de gestora, funcionária ou contador
- [x] Cada perfil vê só o que pode, controlado no próprio banco de dados
- [x] Batida da catraca nunca é apagada nem alterada; toda correção fica registrada com motivo
- [x] Cálculo de horas idêntico ao sistema antigo, conferido com os arquivos reais da catraca
- [x] Validação: aponta batida faltando, atraso, almoço curto e outros casos, com sugestão de correção

Técnico:

- Next.js 16 + Supabase local (portas 553xx); fontes e componentes sem dependência de rede externa
- Migração núcleo + ponto: RLS em todas as tabelas, GRANT explícito, TRUNCATE revogado, anon sem acesso
- Diário `ponto_lancamentos` append-only e batida imutável por trigger; semana fechada travada por trigger
- Motor `lib/ponto`: conta posicional = legado (paridade 50/50 dias reais) separada da validação
- Testes: unidade do motor + matriz de RLS em transação com rollback

## 0.2.0 — Ponto no dia a dia (✅ lançada em 17/10/2026)

A gestora importa o arquivo da catraca, revisa a semana e resolve as pendências.

- [x] Importar o arquivo da catraca com prévia antes de gravar, sem duplicar batidas
- [x] Tela Semana com as horas de cada funcionária e o banco de horas
- [x] Detalhe do dia com linha do tempo, ajustes, desfazer e histórico de quem mudou o quê
- [x] Fila de pendências: aceitar sugestão, justificar, marcar falta e vincular ID desconhecido
- [x] Início da gestora e portal da funcionária para consultar o próprio ponto

Técnico:

- Server actions recalculam o dia antes de gravar e recusam sugestão desatualizada
- Importação em duas etapas (prévia/confirmação), paginada e idempotente por (EnNo, data, hora)
- Verificação no navegador (Playwright) com os três perfis e largura de celular

## 0.3.0 — Histórico e banco de horas (✅ lançada em 17/10/2026)

Tudo o que o sistema antigo já apurou, dentro do sistema novo, com o saldo atual certo.

- [x] 34 semanas do sistema antigo (02/02 a 21/09/2026) importadas, iguais aos relatórios
- [x] Saldo atual do banco de horas igual ao do sistema antigo
- [x] Tela Banco de horas com gráfico, semana a semana, dias pagos e ajustes
- [x] Contador: semanas fechadas, espelho de cada semana e saldos, só leitura
- [x] Cadastro com os nomes reais das funcionárias
- [x] Versão do sistema e este roadmap visíveis dentro do sistema

Técnico:

- `scripts/importar-historico.ts`: confere 100% contra as planilhas, grava e reconfere do banco
- Quebra de saldo do legado vira `ajustes_saldo` com motivo; pendências antigas viram 'apurado na época'
- Regra do motor: tipo escolhido pela gestora impede a unificação automática de duplicadas
- Versionamento: package.json + lib/roadmap.ts (fonte única) + teste de consistência

## 0.4.0 — Fechamento da semana (✅ lançada em 17/10/2026)

Fechar a semana pelo sistema, com espelho e planilha, sem precisar do programa antigo.

- [x] Fechar a semana pela tela, com checklist e confirmação
- [x] Reabrir uma semana fechada (só a gestora, com motivo)
- [x] Espelho de ponto em PDF de cada funcionária, com espaço para assinatura
- [x] Planilha .xlsx da semana no mesmo layout de hoje
- [x] Os espelhos em PDF do sistema antigo anexados às semanas do histórico
- [x] Ajuste manual de saldo pela tela, sempre com motivo
- [x] Contador baixa espelhos e planilhas; a funcionária, só o próprio espelho

Técnico:

- RPC atômica `fechar_semana`/`reabrir_semana`: só a gestora, ordem cronológica, só a última fechada reabre
- Storage `espelhos` com RLS por pasta da funcionária; downloads lidos com a sessão de quem pede
- PDF (pdfkit, fontes Manrope/Jost embutidas, uma página garantida por teste) e xlsx (exceljs)
- Planilha conferida célula a célula contra as 34 originais: só diferem feriados (Falta → Feriado) e a cor de 2 dias justificados
- Histórico: dias anotados à mão como "Justificado" viram ocorrência de falta justificada
- Fluxo completo verificado no navegador (importar → ajustar saldo → fechar → baixar → acessos → reabrir)

## 0.5.0 — Portal da funcionária e pedidos de correção (✅ lançada em 18/10/2026)

A funcionária resolve as pendências dela pelo celular e a gestora só aprova.

- [x] Pedir correção de batida pelo celular, com motivo e foto do atestado
- [x] Minhas pendências, minhas solicitações, meu banco de horas e meus espelhos no celular
- [x] Fila de solicitações da gestora: aprovar vira ajuste, recusar exige resposta
- [x] Resolver várias pendências iguais de uma vez

Técnico:

- RPC atômica `aprovar_solicitacao`: só a gestora, só pedido pendente, e o lançamento tem que ser exatamente o pedido
- Pedido só de dia que já passou e de semana aberta, sem repetir o mesmo pedido; anexo só na pasta da própria funcionária
- Storage `anexos` com RLS: a funcionária envia e lê o dela, a gestora lê tudo, o contador não vê (dado de saúde); ninguém apaga pela API
- Foto reduzida no celular antes do envio (lado maior 1600 px, JPEG)
- Fluxo completo verificado no navegador (pedido com foto → aprovar/recusar → lote → resposta no celular)

## 0.6.0 — Equipe, acessos e regras (✅ lançada em 18/10/2026)

A gestora administra pessoas, acessos e regras sem depender de ninguém.

- [x] Cadastrar, editar e desligar funcionárias (ID da catraca e jornada)
- [x] Cada funcionária vira usuária do sistema: a gestora vincula a funcionária da catraca ao usuário dela
- [x] O nome que aparece em todo o sistema é o que a própria funcionária configura no perfil
- [x] Criar acesso e mandar o convite pelo WhatsApp; redefinir senha; bloquear
- [x] Feriados municipais, pontes e pontos facultativos
- [x] Regras de jornada editáveis, valendo a partir da próxima semana aberta
- [x] Configurações: dados da empresa, usuários e perfis

Técnico:

- Link de senha (uso único, 24 h) validado só quando a pessoa envia a senha: a prévia do WhatsApp abre o link e não pode gastá-lo
- Login pela API de admin só no servidor; o perfil é criado com a sessão da gestora (`criar_perfil`); bloqueio no perfil e no Auth
- Nome: `alterar_meu_nome` muda perfil e cadastro juntos; com acesso ativo, a gestora não muda o nome dela (trigger)
- `definir_regras` grava a versão a partir da primeira semana não fechada; feriado de semana fechada travado no banco; sempre fica uma gestora com acesso
- Funcionária desligada continua nas semanas em que trabalhou (não some do fechamento)
- Fluxo completo verificado no navegador (cadastro → acesso → senha pelo link → nome → bloqueio → desligamento → regras)

## 0.7.0 — Clientes e catálogo (✅ lançada em 24/10/2026)

A base para orçar: quem compra e o que se vende, com preço.

- [x] Cadastro de clientes com residência e endereço da obra
- [x] Catálogo de tecidos, persianas, trilhos, acessórios e serviços com preço
- [x] Regras de cálculo configuráveis (franzimento, sobra de trilho, área mínima)

Técnico:

- Tabelas de vendas com RLS só da gestora (contador e funcionária não veem cliente nem preço)
- Dinheiro em centavos e medidas em centímetros, inteiros do banco à tela (sem erro de arredondamento)
- Unidade amarrada à categoria no banco; produto não se apaga (inativa); nome único por categoria
- Motor de cálculo puro com testes (tecido × franzimento, área mínima, sobra de trilho), pronto para o editor da 0.8
- Rótulo e dica dos formulários ligados por htmlFor/aria-describedby (a dica não entra mais no nome do campo)
- Fluxo completo verificado no navegador (clientes, catálogo, regras, acessos, celular)

## 0.8.0 — Orçamentos (✅ lançada em 24/10/2026)

Montar, enviar e acompanhar orçamentos de cortinas e persianas.

- [x] Editor por ambiente com cálculo automático e memória de cálculo visível
- [x] Versão de celular para lançar as medidas na visita técnica
- [x] PDF do orçamento e envio por WhatsApp
- [x] Situação do orçamento: rascunho, enviado, aprovado, recusado, vencido
- [x] Opcional: página para a cliente aprovar pelo celular

Técnico:

- Numeração sem buraco: contador em tabela travado na transação (sequence pularia número); orçamento não se apaga, rascunho descartado fica cancelado
- Preço congelado no item: guarda os preços da época; mudar medida não reprecifica, trocar o produto pega o preço atual
- O servidor recalcula tudo com o mesmo motor da tela e grava de uma vez (RPC salvar_orcamento); salvamento automático em ordem
- Situação validada no banco: só as transições do fluxo, conteúdo travado fora do rascunho, vencido calculado pela validade
- Link da cliente por token aleatório; o anon só executa as duas funções do link; abrir não aprova (a prévia do WhatsApp abre)
- Ambiente de teste isolado (Supabase 573xx + app em modo produção) para os testes de navegador não tocarem nos dados reais

## 0.9.0 — Recibos (✅ lançada em 24/10/2026)

Registrar cada pagamento de cliente e saber quanto falta receber.

- [x] Emitir recibo de sinal, parcela ou quitação a partir do orçamento, ou avulso
- [x] Valor por extenso automático e impressão em meia folha com duas vias
- [x] Cancelar com motivo, sem reaproveitar o número
- [x] Saldo a receber no Início e exportação para o contador

Técnico:

- Valor do recibo limitado ao saldo do orçamento no banco, com o orçamento travado na transação; quitação só do saldo exato
- Recibo emitido não muda; cancelamento com motivo; número sem buraco; orçamento com recibo emitido não desfaz a aprovação
- Contador só lê: o recibo guarda o nome de quem pagou e o número do orçamento (ele não vê clientes nem orçamentos)
- Valor por extenso em português do Brasil com testes (milhão redondo, "mil e duzentos", singular)
- Fluxo completo verificado no ambiente de teste (sinal, saldo, quitação, cancelamento, avulso, exportação, contador)

## 0.9.1 — Segurança e testes (✅ lançada em 24/10/2026)

Fechar as brechas achadas na auditoria de segurança e testar todas as telas automaticamente.

- [x] Auditoria de segurança do sistema inteiro, com as correções aplicadas
- [x] Todas as telas testadas automaticamente com cada tipo de usuário, no computador e no celular
- [x] Todo erro encontrado vira um teste que impede que ele volte

Técnico:

- Regressão no navegador (Playwright: portal, equipe, vendas, orçamentos, recibos, segurança) e smoke de telas (todas as rotas × 4 papéis, computador e celular) no ambiente de teste isolado
- Agente de QA (`.claude/agents/qa-smoke.md`) e registro de regressões (`tests/REGRESSOES.md`)
- Cobertura de RLS e permissões lida do catálogo do banco: tabela, permissão ou função SECURITY DEFINER nova reprova até ser revisada
- Next 16.4.3 (DoS sem login em Server Actions), cookie da sessão HttpOnly por 30 dias, cabeçalhos de segurança, volta do login só para dentro do site
- Revogados MAINTAIN/TRUNCATE/TRIGGER/REFERENCES/setval que o Postgres 17 do Supabase concede por padrão; pedido de correção validado no banco (anexo, data, duplicado)

## 0.10.0 — Pronto para subir (✅ lançada em 24/10/2026)

Deixar tudo pronto para pôr o sistema no ar: pacote da VPS, cópia de segurança, guia e testes automáticos.

- [x] Guia rápido de uso dentro do sistema, para a gestora, o contador e as funcionárias
- [x] Cópia de segurança de todos os dados e arquivos, com a restauração ensaiada de ponta a ponta
- [x] Testes automáticos a cada mudança (GitHub)
- [x] Mais proteção no login: limite de tentativas erradas e troca de senha pedindo a senha atual
- [x] Pacote para a VPS: o sistema em container, HTTPS automático e o roteiro de implantação

Técnico:

- Build standalone (fontes do PDF incluídas) e Dockerfile; a regressão e o smoke inteiros passaram contra o container de produção
- Supabase self-hosting oficial fixado numa versão, com segredos gerados na VPS e nada exposto além de 80/443 (deploy/)
- Empresa, regra de ponto e feriados nacionais até 2030 como migração (o seed.sql não roda em produção)
- Fechar e reabrir semana só pelas funções do banco (gatilho recusa gravação direta da gestora)
- Cópia: dados de public/auth/storage + arquivos do Storage + contagem por tabela; restauração confere a contagem
- /api/saude para o monitoramento e erros do servidor em JSON no log (instrumentation.ts)
- Testes usavam a data UTC como "hoje": falhavam toda noite depois das 21h (corrigido para o fuso da loja)

## 0.11.0 — Decisões aplicadas (✅ lançada em 25/10/2026)

Pôr em prática as decisões de 25/10/2026 antes de subir.

- [x] Verificação em duas etapas opcional (código de um app no celular), para quem quiser
- [x] Esqueci minha senha por e-mail, para quem entra com e-mail
- [x] Espelho e planilha do contador saem com o nome do cadastro
- [x] O link do orçamento para a cliente expira 30 dias depois de vencer

Técnico:

- TOTP do Supabase: login com senha certa leva a /login/codigo e, até o código, a sessão não conta (telas, arquivos e ações recusam)
- Redefinir senha (tela e scripts/producao.ts link) também apaga os fatores: a saída de quem perdeu o celular
- Modelo do e-mail em supabase/templates (servido pelo app para o Auth da VPS) com o link para /auth/confirmar e type=recovery
- Um montador só para o link de senha (lib/link-senha.ts): o script da VPS saía sem type=recovery ("Link incompleto")
- orcamento_publico devolve só a data de expiração depois de valido_ate + 30 (aprovado continua visível)

## 0.11.1 — Ensaio da VPS (✅ lançada em 25/10/2026)

Ensaiar a subida inteira com o Supabase oficial e deixar o pacote cabendo no KVM 1 (4 GB).

- [x] Subida ensaiada de ponta a ponta: banco, sistema, primeira gestora, cópia e restauração
- [x] Cabe com folga no plano de 4 GB (~0,5 GB em uso)

Técnico:

- Imagem única para qualquer ambiente (o Supabase é lido quando o servidor sobe), publicada pela CI no ghcr.io a cada tag
- Supabase oficial enxuto: só gateway, Postgres, Auth, PostgREST e Storage; Studio sob demanda (perfil painel)
- Achados do ensaio: /api/saude usava a raiz /rest/v1/ (bloqueada ao anônimo no gateway oficial); db push falha com TLS (vale migration up com sslmode=disable); o tsconfig pegava o Supabase baixado em deploy/; nome do projeto de produção colidia com o do Supabase CLI local

## 1.0.0 — No ar (🔜 próxima)

O sistema rodando na VPS, com os dados reais, protegido e com cópia de segurança.

- [ ] Sistema publicado na VPS com endereço próprio e conexão segura (HTTPS)
- [ ] Cópia de segurança rodando todo dia na VPS, com uma cópia fora dela
- [ ] Dados reais migrados: cadastro, histórico e saldos
- [ ] Aviso automático se o sistema sair do ar
- [ ] E-mail para recuperação de senha (se for usar)

Técnico:

- Seguir deploy/README.md: preparar.sh (Supabase + segredos), db push, compose do app, producao.ts (gestora e cadastro), importar-historico --gravar, cron do backup.sh
- Monitor externo (UptimeRobot ou similar) em /api/saude
- Limite de login do Auth alto na VPS: ele só vê o IP do servidor Next; quem limita por pessoa é o app (lib/limite.ts)
- MFA para gestora e contador, conforme a decisão
- E-mail: modelo de recuperação apontando para /auth/confirmar?token_hash=… (o link padrão vai para o Auth, que não fica na internet)
- Ensaiar a restauração na VPS (deploy/backup/restaurar.sh) antes de liberar o uso e a cada atualização do Supabase

## Depois da 1.0

- Agenda de instalação
- Estoque
- Nota fiscal
- Folha de pagamento completa
- Contas a pagar
- Leitura direta da catraca, sem precisar exportar o arquivo

## Decisões em aberto

Nenhuma no momento.

## Decisões tomadas

- [x] VPS: Hostinger KVM 1 (4 GB, com swap, Supabase enxuto e a imagem montada pela CI), em São Paulo se houver; SEM domínio: o endereço é o nome que a Hostinger dá à VPS (srv….hstgr.cloud), com HTTPS (25/10/2026)
- [x] Cópias de segurança fora da VPS: Backblaze B2 (25/10/2026)
- [x] Verificação em duas etapas: opcional para todos, cada um liga em Minha conta / Meu perfil (25/10/2026)
- [x] Recuperar senha por e-mail: sim, pelo Gmail da loja (SMTP com senha de app), já que sem domínio Resend/Brevo não enviam; o link no WhatsApp continua (25/10/2026)
- [x] Documentos oficiais (espelho e planilha) saem com o nome do cadastro; o nome escolhido pela funcionária fica nas telas (25/10/2026)
- [x] Link do orçamento para a cliente expira 30 dias depois de vencer (25/10/2026)
- [x] Quem está bloqueada continua vendo "Seu acesso está bloqueado" (25/10/2026)

## Como lançar uma versão

1. Marque as entregas como feitas em `lib/roadmap.ts` e mude o status para `lancada` com a data.
2. Suba o `version` do `package.json` para o mesmo número.
3. Rode `npm run roadmap` (regera este arquivo) e `npm test` (confere versão e roadmap).
