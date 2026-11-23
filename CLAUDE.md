@AGENTS.md

# Cristina's Decorações — sistema de gestão

Empresa pequena de **cortinas e persianas sob medida**. Três módulos: **Ponto/RH** (o mais importante),
**Orçamentos** e **Recibos** (pagamentos de clientes). Hospedagem final numa VPS; hoje roda local.

Perfis (RLS): **gestora** (tudo), **funcionária** (só o próprio ponto, pelo celular), **contador** (só leitura de RH e recibos).

## Rodar local

```powershell
npx supabase start          # Docker precisa estar aberto. Portas 553xx (o ISA usa 543xx: os dois sobem juntos)
npm run dev                 # http://127.0.0.1:3100  (use 127.0.0.1, não localhost: o cookie é dessa origem)
npx tsx --env-file=.env.development.local scripts/seed-dev.ts   # usuários de dev (idempotente)
```

Logins de dev (senha `Cristinas2026`, só no banco local): `cristina` (gestora), `contador` e um por funcionária.
O cadastro real das funcionárias fica em `dados/funcionarias.csv` (**fora do git**: nomes reais e IDs da catraca).
O nome exibido é o que a funcionária configura no próprio perfil (`alterar_meu_nome`);
o seed usa esse arquivo e cai no `scripts/dados-exemplo/` (nomes fictícios) se ele não existir. Com ele dá para
importar os GLog do projeto `../Pontos` em **Ponto → Importar arquivo**.

| serviço | endereço |
|---|---|
| app | http://127.0.0.1:3100 |
| API Supabase | http://127.0.0.1:55321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |
| Studio · Mailpit | :55323 · :55324 |

## Histórico do sistema antigo (já importado no banco local)

As 34 semanas de 02/02 a 21/09/2026 vieram dos relatórios do `../Pontos` como **semanas fechadas**, com os
números oficiais da época (o saldo final bate com o `saldos.csv` do Pontos). Para refazer num banco limpo:

```powershell
npx supabase db reset; npx tsx --env-file=.env.development.local scripts/seed-dev.ts
python scripts/legado_historico.py ../Pontos/data/output > dados/historico-legado.json
npx tsx --env-file=.env.development.local scripts/importar-historico.ts            # só confere
npx tsx --env-file=.env.development.local scripts/importar-historico.ts --gravar   # grava e reconfere do banco
npx tsx --env-file=.env.development.local scripts/anexar-pdfs-legado.ts            # anexa os 170 PDFs antigos
```

O importador recusa se já houver semana fechada. Batidas vêm do GLog bruto quando existe (02/02 e 21/09) e,
nas outras semanas, dos horários da planilha. O que o motor novo aponta nessas semanas fica registrado como
"apurado assim no relatório da época"; a única quebra de saldo do legado (27/07, +1h15, ponto justificado)
virou ajuste de saldo com motivo. Motivos conhecidos das quebras ficam em `dados/historico-motivos.json` (fora do
git, cita nomes). Na VPS, o mesmo script roda uma vez contra produção (`--gestora=<login>`).

## Git

Cópia pública do código para estudo; o desenvolvimento e a CI seguem num repositório privado.
Cada versão lançada ganha uma tag `vX.Y.Z` no commit que fecha a versão. Nomes reais das funcionárias e dados da
catraca nunca entram no git (`dados/` é ignorado).

## Versão e roadmap

Versão atual no `package.json` (semver); aparece no rodapé do menu, no login, no portal e em `/versao`.
O roadmap até a 1.0 mora em **`lib/roadmap.ts`** (fonte única): a tela `/versao` e o `ROADMAP.md` saem dele.
Para lançar uma versão: marcar as entregas em `lib/roadmap.ts`, status `lancada` com data, subir o `version`
do `package.json`, `npm run roadmap`. O `npm test` falha se versão, roadmap e `ROADMAP.md` divergirem.
Decisões pendentes do usuário ficam em `DECISOES_EM_ABERTO` (só no ROADMAP.md, não na tela).

## Banco local: não zerar quando houver dado do usuário

Mudança de esquema entra como **migração nova** aplicada com `npx supabase migration up` (incremental).
`npx supabase db reset` apaga tudo: só use se `importacoes` tiver apenas as cargas do histórico e você recarregar
seed + histórico + PDFs logo em seguida.

## Fechamento (0.4)

- `fechar_semana` (RPC atômica) recebe a fotografia calculada pelo motor (`lib/ponto/fechamento.ts`), recusa fora de
  ordem e grava `semana_resultados`/`semana_resultado_dias`; `reabrir_semana` só na última fechada, com motivo.
- Espelhos: bucket `espelhos`, caminho `<funcionaria_id>/<segunda>.pdf`; download em `/arquivos/espelho/...` com a
  sessão de quem pede (o Storage aplica o RLS). Planilha gerada na hora em `/arquivos/planilha/<segunda>`.
- Impressos em `lib/impressos`: PDF com pdfkit (fontes de `node_modules/@fontsource`, `serverExternalPackages`) e
  xlsx com exceljs no layout exato do sistema antigo (K = saldo anterior + ajustes, como o legado fazia).

## Portal da funcionária e pedidos de correção (0.5)

- Portal em `/meu-ponto` (celular, abas Ponto · Banco · Pendências · Pedidos · Espelhos). Pendência para ela é só
  o que **bloqueia** (`pendenciasParaFuncionaria`); aviso fica com a gestora.
- Pedido (`app/meu-ponto/acoes.ts`) vai com a sessão dela. O banco recusa dia futuro, semana fechada e anexo fora
  da pasta dela (trigger `valida_solicitacao`). Anexo no bucket `anexos`, caminho `<funcionaria_id>/<data>-<uuid>.<ext>`,
  servido por `/arquivos/anexo/...`; o **contador não vê** (dado de saúde). A foto é reduzida no navegador.
- Aprovar: o servidor decide adicionar × alterar (`planoDeAprovacao`) e a RPC `aprovar_solicitacao` só aceita o
  lançamento igual ao pedido, gravando lançamento + resposta juntos. Recusar exige resposta.
- Lote nas Pendências (`aceitarSugestoes`): só pendências do mesmo tipo, num INSERT só.

## Equipe, acessos e regras (0.6)

- Login novo: `lib/acessos.ts` (API de admin, só no servidor, depois de `exigirPapel("gestora")`) cria o usuário
  **sem senha**; o perfil vem do `criar_perfil` com a sessão da gestora. Se o perfil falhar, o login é apagado.
- Senha por link: `generateLink` (recovery) → `/auth/confirmar?token_hash=…`. **A página não valida o link ao abrir**
  (a prévia do WhatsApp abre sozinha e gastaria o link de uso único); valida no envio da senha (`definirSenha`).
  Prazo: `otp_expiry = 86400` no `config.toml`. Endereço do link: `APP_URL` (obrigatório em produção).
- Bloquear = `perfis.ativo = false` + ban no Auth. Desligar a funcionária bloqueia o acesso; ela continua nas semanas
  em que trabalhou (`carregarSemana` inclui inativa com movimento).
- Nome com acesso ativo é dela: trigger recusa a gestora mudar `nome_exibicao`. Sempre fica uma gestora ativa (trigger).
- Regras: `definir_regras` grava a partir da primeira semana não fechada e apaga versões posteriores. Feriado de
  semana fechada não entra nem sai (trigger).
- Diálogo do link mora no `ProvedorLinks` da página: criar o acesso recarrega a linha e o link sumiria com ela.

## Clientes e catálogo (0.7)

- Tabelas `clientes`, `produtos`, `modelos_confeccao`, `regras_orcamento` (linha única): **só a gestora** (RLS).
  Dinheiro em **centavos** e medidas em **centímetros** (área em cm²), sempre inteiros; conversão de/para o
  formato brasileiro em `lib/vendas/numeros.ts`. Regras de cálculo puras em `lib/vendas/calculo.ts`.
- A unidade do produto segue a categoria (constraint). Produto e modelo **não se apagam**: inativam (os orçamentos
  vão apontar para eles). Cliente se apaga enquanto não tiver orçamento (a FK da 0.8 vai recusar).
- O seed de dev cria catálogo e 3 clientes **de exemplo** (valores do protótipo, nomes fictícios com "(exemplo)").
- Formulário novo: use `Rotulado`/`CampoDinheiro` (`components/ui/rotulado.tsx`); dica dentro do `<label>` entra
  no nome acessível do campo.

## Orçamentos (0.8)

- `orcamentos` → `orcamento_ambientes` → `orcamento_itens`, só da gestora. Número pelo trigger `numera_orcamento`
  (contador em `numeracao`, travado na transação: **sem buraco**). Orçamento não se apaga; rascunho descartado = `cancelado`.
- Motor em `lib/vendas/orcamento.ts` (puro; roda na tela e no servidor). **Preço congelado**: o item guarda `precos`
  da época; só troca de produto (`chaveDePreco`) pega o preço atual. O servidor recalcula e grava tudo pela RPC
  `salvar_orcamento` (substitui ambientes e itens de uma vez).
- Situação: o trigger `valida_orcamento` só aceita as transições do fluxo e trava o conteúdo fora do rascunho
  (só `obs_interna` muda). "Vencido" não é gravado: é `enviado` com `valido_ate` no passado. Validade conta do envio.
- Cliente: `/o/<token>` (público no `proxy.ts`), dados por `orcamento_publico`, aprovação por `aprovar_orcamento_publico`
  — as duas únicas funções liberadas para o anon. Abrir não aprova (a prévia do WhatsApp abre o link).
- O editor salva sozinho (~1 s) em ordem e chama `garantirSalvo` antes de mudar a situação. A `key` do editor é
  só o id: mudar a situação não pode remontá-lo.

## Recibos (0.9)

- `recibos`: sinal, parcela, quitação (de orçamento **aprovado**) ou avulso. O trigger `emite_recibo` numera (contador
  `numeracao`, sem buraco), trava o orçamento na transação e recusa valor acima do saldo; quitação = saldo exato.
- Recibo emitido não muda (`valida_recibo`): só cancela, com motivo; o número não volta. Orçamento com recibo emitido
  não desfaz a aprovação (`trava_orcamento_com_recibo`). Saldo por orçamento: view `saldos_orcamentos` (security_invoker).
- Contador lê recibos (RLS), mas não clientes nem orçamentos: o recibo guarda `pagador` e `orcamento_numero`.
- Extenso em `lib/vendas/extenso.ts`; PDF meia folha / duas vias em `lib/impressos/recibo.ts`; .xlsx do mês em
  `/arquivos/recibos?mes=AAAA-MM` (gestora e contador). Mensagens de erro do banco usam `public.reais()` (formato BR).

## Segurança (auditoria de 24/10/2026, 0.9.1)

- Sessão: cookie HttpOnly, SameSite=Lax, 30 dias sem uso (`lib/config.ts`). Só o servidor fala com o Supabase
  (não existe `createBrowserClient`); se um dia precisar do Supabase no navegador, o HttpOnly impede — repensar.
- `?volta=` do login passa por `destinoSeguro` (`lib/destino.ts`): "/\x.com" e "/<tab>/x.com" viram outro site no navegador.
- Cabeçalhos de segurança em toda resposta (`next.config.ts`); HSTS só com `APP_URL` em https.
- O Postgres 17 do Supabase concede **MAINTAIN, TRUNCATE, TRIGGER, REFERENCES e setval** a anon/authenticated em
  todo objeto novo do public. A `20261027090000_seguranca.sql` revoga e muda os default privileges; o GRANT
  explícito por tabela continua obrigatório, e o `cobertura.test.ts` pega o que escapar.
- O banco repete o que o app garante no pedido de correção (a funcionária tem o próprio JWT e pode falar direto
  com a API): anexo só `<funcionaria>/<data>-<uuid>.<ext>` existente no Storage, `criada_em` do banco, motivo
  ≤ 500, um pedido pendente por batida (ou ocorrência) no dia.
- `seed-dev.ts` só roda nas portas 55321/57321 (não basta ser 127.0.0.1: a VPS também usa o loopback) e não troca
  a senha de quem já existe (`--redefinir-senhas` força).
- Pendente para a 1.0 (em `lib/roadmap.ts`): MFA para gestora e contador, limite de tentativas no login (o GoTrue
  só vê o IP do servidor Next), troca de senha pedindo a atual, Supabase fora da internet na VPS, fechar/reabrir
  semana só por RPC (a gestora tem UPDATE direto em `semanas`/`semana_resultados`).

## Produção e VPS (0.10)

- Roteiro completo em **`deploy/README.md`**, **ensaiado em 25/10/2026** com o Supabase oficial local: Supabase
  self-hosting (versão fixada em `deploy/supabase/preparar.sh`, segredos gerados na VPS, enxuto para o KVM 1 —
  realtime/functions/imgproxy/supavisor desligados, Studio sob demanda) e o app pela imagem que a CI publica no
  `ghcr.io` a cada tag (a VPS não monta nada). Só 80/443 na internet; gateway e Postgres só em 127.0.0.1.
- A imagem é uma só para qualquer ambiente: **endereço e chave do Supabase são lidos quando o servidor sobe**
  (`lib/config.ts`, acesso por nome); `process.env.NEXT_PUBLIC_…` direto é proibido (o Next embutiria no build;
  `tests/unit/config.test.ts` reprova).
- Migração na VPS: `npx supabase migration up --db-url "…@127.0.0.1:5432/postgres?sslmode=disable"` (o `db push`
  falha com TLS contra o Postgres oficial). O projeto de produção chama `cristinas-producao` (o Supabase CLI local
  usa "cristinas" nos containers: não colidir).
- O app de teste (3300) roda o MESMO `server.js` standalone da imagem (`scripts/servidor-teste.mjs`); a suíte
  inteira também já passou contra o container (`docker run … -p 127.0.0.1:3300:3000` + `E2E_REUSAR=1`).
- `supabase/seed.sql` não roda em produção: empresa, regra de ponto e feriados nacionais (até 2030) estão na
  migração `20261028090000_producao.sql`. Dado de referência novo = migração, nunca seed.
- Fechar/reabrir semana só por `fechar_semana`/`reabrir_semana`: elas marcam a transação
  (`cristinas.fechamento`) e o gatilho `protege_fechamento` recusa gravação direta da gestora (importar cria semana
  aberta; gerar espelho grava só o `espelho_path`). Script com a chave secreta passa (não é `authenticated`).
- Login: limite de tentativas na memória do processo (`lib/limite.ts`, 5 por usuário e 50 por IP em 15 min; IP =
  último do X-Forwarded-For, posto pelo Caddy). Trocar senha logada pede a atual (verificada num cliente à parte).
- `/api/saude` (público, sem dado) para o monitor externo; erro do servidor vira uma linha JSON no log
  (`instrumentation.ts`, sem endereço com token nem cabeçalhos).
- Cópia: `deploy/backup/backup.sh` (dados de public/auth/storage + arquivos + contagem por tabela) e
  `restaurar.sh` (num banco com as mesmas migrações; confere a contagem). Ensaio local: `bash scripts/ensaiar-restauracao.sh`.
- Primeira carga na VPS: `deploy/ferramenta.sh scripts/producao.ts gestora|funcionarias|link`.
- Guia de uso: `lib/guia.ts` → `/ajuda` (gestora, contador) e `/meu-ponto/ajuda`. Mudou um botão ou tela? Atualize o guia.
- CI: `.github/workflows/testes.yml` (tipos, lint, unidade, banco, regressão e smoke) com o cadastro de exemplo e
  sem histórico. Reproduzir aqui: `E2E_SEM_HISTORICO=1 SEED_FUNCIONARIAS_CSV=scripts/dados-exemplo/funcionarias.csv npx playwright test`.

## Decisões aplicadas (0.11, decididas em 25/10/2026)

- **Duas etapas (TOTP), opcional**: `estadoDoLogin` (lib/auth.ts) só dá sessão com aal2 a quem tem fator
  verificado; senha certa → `/login/codigo` (`verificarCodigo`, mesmo limite do login). Ligar/desligar em Minha
  conta e Meu perfil (`components/conta/duas-etapas.tsx`). **Redefinir senha também apaga os fatores**
  (`lib/duas-etapas.ts`), é a saída de quem perdeu o celular. A trava é no app: na VPS a API do Supabase não fica
  na internet (localmente fica, então não vale como teste de segurança).
- **Esqueci minha senha por e-mail** (só login com e-mail; funcionária continua pelo WhatsApp): `pedirLinkPorEmail`
  → modelo `supabase/templates/recuperar-senha.html` (local: config.toml; VPS: o Auth busca em
  `http://app:3000/modelos/recuperar-senha`). Link = `/auth/confirmar?token_hash=…&type=recovery`, sempre por
  `montarLinkDeSenha` (lib/link-senha.ts). No teste, o e-mail cai no Mailpit (57324).
- **Documentos oficiais com o nome do cadastro** (`lib/impressos/dados.ts`); o nome escolhido fica nas telas.
- **Link do orçamento expira 30 dias depois de vencer** (`orcamento_publico`; aprovado não expira).
- Mudou o `config.toml` (auth)? O Supabase local só lê na partida: `npx supabase stop && npx supabase start`
  (os dados ficam). No ambiente de teste: `stop --workdir .ambiente-teste` + `ambiente-teste.ts preparar`.

## Ambiente de teste (desde a 0.8) — teste de navegador NUNCA no banco de uso

O banco local de uso (553xx) tem dados reais desde 24/10/2026. Testes de navegador criam dados; rodam num segundo
Supabase (projeto `cristinas-teste`, portas **573xx**; 563xx é do `isa-worker`) com o app em modo produção na 3300:

```bash
npm run e2e        # regressão: os fluxos de cada versão no navegador (tests/e2e/regressao)
npm run smoke      # smoke: TODA tela × todo papel procurando erro (tests/e2e/smoke), fotos em test-results/telas/
```

Cada rodada sobe o Supabase de teste se estiver parado, **zera o banco de teste** (~1 min: migrações, seed,
histórico e PDFs se `dados/` existir) e faz o build de produção (~1–2 min). `E2E_SEM_ZERAR=1` mantém o banco;
`E2E_REUSAR=1` usa um app já aberto na 3300 (pode estar com código velho). À mão:
`npx tsx scripts/ambiente-teste.ts preparar|zerar|parar` e `node scripts/servidor-teste.mjs` (build + start 3300).
Os specs recusam qualquer endereço fora do ambiente de teste (`tests/e2e/apoio/ambiente.ts`, sem variável para trocar).

- Funcionária nos specs = `loginDaCatraca(db, "<ID>")`: o banco de teste pode ter o cadastro real; nome real nunca
  entra em spec. A semana sintética (28/09/2026, IDs 1, 4, 5, 6, 7) mora em `tests/e2e/apoio/glog.ts`.
- Em modo produção o cookie de sessão é `Secure` e HttpOnly: o navegador o manda para `http://127.0.0.1`, o
  cliente HTTP avulso do Playwright não — baixe arquivos com `baixar()` (fetch de dentro da página).
- Tela ou rota de arquivo nova **reprova o smoke** até ganhar linha na matriz `tests/e2e/smoke/rotas.ts` (quem abre).
- Agente de QA: `.claude/agents/qa-smoke.md` (roda o smoke, revisa as fotos, cada erro real vira teste).

## Testes

**Todo erro vira teste** (pedido do usuário, 24/10/2026): erro achado por quem quer que seja — smoke, auditoria,
usuário, revisão — só está corrigido quando há um teste que falha sem a correção e passa com ela, no nível mais
barato que o pega (unidade, banco ou navegador). Registre em `tests/REGRESSOES.md`.

- `npm test` — unidade + **testes de banco** (`tests/rls`): rodam no **banco de teste** (57322; suba o ambiente de
  teste antes), em transação com ROLLBACK.
- `tests/rls/cobertura.test.ts` lê o catálogo: toda tabela com RLS e policy, anon sem nada, sem
  TRUNCATE/TRIGGER/REFERENCES/MAINTAIN, só as funções SECURITY DEFINER revisadas. **Tabela, permissão ou função
  SECURITY DEFINER nova reprova até entrar nas listas dele** — é a revisão de segurança no mesmo commit. O `montar()` trata como fechadas as semanas antes de 2031 (o fechamento
  exige fechar as anteriores), para não depender do que houver no banco.
- `npm run paridade -- ../Pontos/data/input/001_GLog.txt` — compara dia a dia com o **Python legado** (`../Pontos`). Tem que dar 100% idêntico; diferença só é aceitável em dia com pendência que bloqueia.
- `npm run db:types` depois de mudar o schema.
- Rode os testes com `npm test` (scripts/testar.mjs), não com `npx vitest` direto: no Windows, com a pasta
  atual em "c:\…" (drive minúsculo), o vitest se carrega por dois caminhos e TODOS os arquivos falham com
  "failed to find the runner". O lançador normaliza o drive (reproduzido e corrigido em 24/10/2026).
- Teste de banco com pedido de correção usa `TERCA_PASSADA` (2021): o banco recusa pedido de dia futuro, e as
  semanas de 2031 dos outros testes estão no futuro.

## Regras do ponto (confirmadas pelo usuário em 17/10/2026 — não mudar sem perguntar)

- Jornada seg–qui 9h, sex 8h, almoço 1h. Banco semanal: saldo anterior + extras = acumulado; ao chegar à
  **hora de corte (8h, tolerância 10 min)** ganha **1 dia pago** e o excedente segue.
- **Almoço < 1h não gera crédito** (conta como 1h). **Dia abaixo da carga não desconta** (extra = max(0, …)).
- **Sábado/domingo e feriado ficam fora do banco** (aparecem com aviso). Feriado confirmado pelo usuário em 17/10/2026.
- O protótipo do Claude Design assumiu o contrário nessas três; **o protótipo não é fonte de regra de negócio**.

## Princípios de arquitetura

- `lib/ponto/dia.ts`: a **conta** das horas é o port literal do legado (posicional); a **validação** (classificar
  pelo horário, pendências, sugestões) é separada e nunca muda a conta sozinha. O IOMd da catraca **não é confiável**
  (errado em 17 de 25 dias reais) — só exibição.
- Batida da catraca é **imutável** (trigger). Toda correção é linha nova em `ponto_lancamentos`, **append-only**
  (trigger barra UPDATE/DELETE até do superusuário). "Desfazer" = lançamento `cancelar`. O histórico do dia é o diário.
- Resolução de pendência guarda a **assinatura** do dia; se as batidas mudarem, a pendência reabre.
- Semana fechada é travada **no banco** (trigger), não só na tela.
- Toda server action **recalcula o dia** antes de gravar e recusa sugestão velha.
- Supabase novo **não concede privilégio** em tabela nova: cada tabela tem `GRANT` explícito no fim da migração.
  TRUNCATE (que ignora RLS) é revogado. `anon` não tem nada.
- `lib/supabase/admin.ts` (chave secreta, ignora RLS) é só para criar login/redefinir senha. Dado de negócio sempre pelo cliente com sessão.

## Armadilhas já encontradas

- `[auth.email] enable_signup = false` no `config.toml` **desliga o login por e-mail**. O bloqueio de cadastro
  público é o `[auth] enable_signup = false` (já está).
- `ui.shadcn.com` é bloqueado pela rede corporativa: os componentes de `components/ui` foram escritos à mão no padrão shadcn.
- `next build` não lê `.env.development.local`; para testar o build local, carregue as variáveis antes.
- Usuário sem e-mail loga só com o usuário (ex.: `ana.s`) → `ana.s@usuarios.cristinas.invalid` (`lib/auth.ts`).
- As migrações são PostgreSQL; a extensão mssql do VS Code marca falso erro (desligado em `.vscode/settings.json`).
- Formulário com server action (React 19) **limpa os campos não controlados** depois do envio: o login perde a
  senha após um erro. Em teste de navegador, preencha de novo; e espere `networkidle` antes de preencher campo
  controlado (preencher antes da hidratação é desfeito).
- Botão dentro de `<label>` rouba o rótulo do campo (o leitor de tela e o `getByLabel` apontam para o botão).
  Voltou no login em 24/10/2026 (o smoke pegou): rótulo com `htmlFor` e o botão fora do `<label>`.
- `flex-1 min-w-0` numa linha com `flex-wrap` nunca quebra (a base é 0): o campo encolhe até sumir no celular.
  Use `grow basis-40` (base real) para a linha quebrar.
- **"Hoje" em SQL é `(now() at time zone 'America/Sao_Paulo')::date`**, nunca `current_date`: o banco roda em UTC
  e depois das 21h de Brasília o `current_date` já é amanhã (os testes falhavam toda noite; `HOJE`/`HOJE_SQL` nos apoios).
- O Storage do Supabase guarda tipo e tamanho de cada arquivo em **atributos estendidos (xattr)**: copiar os
  arquivos sem eles (tar do busybox) faz todo download dar 500. Backup/restauração usam GNU tar com `--xattrs`.
- Gatilho BEFORE INSERT dispara antes do `on conflict do nothing`: migração idempotente que insere em tabela com
  trigger que recusa (ex.: `protege_feriado`) precisa de `where not exists`.
- PL/pgSQL avalia `new.<coluna>` mesmo dentro de `if tg_table_name = 'x' and new.coluna …`: num gatilho
  compartilhado por tabelas diferentes, use `if` aninhado.
- O Next tem um `role="alert"` próprio (`#__next-route-announcer__`, vazio): em teste, `getByRole("alert")` pega
  dois; use `[role="alert"]:not(#__next-route-announcer__)`.
- PostgREST em INSERT em lote manda `null` (não o padrão da coluna) no campo que falta em alguma das linhas.
- Não há Prettier no projeto e o código usa linhas de até ~180 colunas: `npx prettier` no padrão (80) reformata
  o arquivo inteiro. Se for formatar arquivo novo: `--print-width 180 --object-wrap collapse`.

## Estado e próximos passos

Pronto (0.10 — tudo pronto para subir: pacote da VPS, cópia de segurança ensaiada, guia de uso, CI; antes, 0.9.1: auditoria de segurança, regressão e smoke): login por papel, Importar arquivo, Semana, Pendências (com lote), Banco de horas, Fechamento (espelho
PDF + .xlsx, reabrir, ajuste de saldo), Solicitações de correção, portal da funcionária completo, contador,
Equipe (cadastro e acessos por link no WhatsApp), Calendário e regras, Configurações, Minha conta, Clientes,
Catálogo e regras de cálculo, Orçamentos (editor, PDF, WhatsApp, link da cliente), Recibos (saldo, duas vias,
cancelamento, exportação), histórico do sistema antigo. Próximo: a 1.0 — subir na VPS seguindo `deploy/README.md` (depende de VPS, domínio e destino das cópias; decisões em `ROADMAP.md`). Ordem e detalhe em `lib/roadmap.ts`. Design de referência: `docs/design/prototipo`
(faltaram no export do Claude Design as páginas `Impressos A4` e `Design System`).
