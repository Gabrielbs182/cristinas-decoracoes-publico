# Registro de regressões

**Todo erro vira teste.** Erro achado (pelo smoke, pela auditoria, pelo usuário, numa revisão) só está corrigido
quando existe um teste que **falha sem a correção e passa com ela**, no nível mais barato que pega o erro:

| nível | onde | roda com |
|---|---|---|
| regra pura | `tests/unit` | `npm test` |
| banco, permissão, RLS | `tests/rls` (banco de teste 57322, transação com ROLLBACK) | `npm test` |
| fluxo no navegador | `tests/e2e/regressao` | `npm run e2e` |
| classe de erro que pode aparecer em qualquer tela | conferência nova em `tests/e2e/smoke/telas.spec.ts` | `npm run smoke` |

Cada linha abaixo é um erro real e o teste que impede que ele volte. Linha nova vai no fim.

## Antes da regra (0.5 a 0.9): erros já cobertos pelos testes atuais

| versão | erro | teste que trava |
|---|---|---|
| 0.5 | Lote de pendências gravava `null` em coluna com padrão (PostgREST manda `null` no campo que falta em alguma linha) | `e2e/regressao/01-portal` · "pendências em lote só do mesmo tipo" |
| 0.6 | Diálogo com o link do convite sumia quando a linha da equipe recarregava | `e2e/regressao/02-equipe` · "cria o acesso e gera o link" |
| 0.6 | Botão dentro do `<label>` roubava o rótulo do campo (jornada própria) | `e2e/regressao/02-equipe` · `getByLabel("Jornada própria")` |
| 0.6 | Funcionária bloqueada via "usuário ou senha incorretos" | `e2e/regressao/02-equipe` · "bloquear e desbloquear" |
| 0.6 | Login da gestora quebrava com `maybeSingle` em `perfis` (ela vê todos os perfis) | todo spec de navegador entra como gestora |
| 0.7 | `atualizado_em`/`atualizado_por` das regras de cálculo não mudavam no UPDATE | `rls/vendas` · "regras são uma linha só e atualizado_em acompanha a mudança" |
| 0.7 | Dica dentro do `<label>` entrava no nome acessível do campo | `e2e/regressao/03-vendas` · `getByLabel(..., { exact: true })` |
| 0.8 | Mudar a situação do orçamento deixava mudar o conteúdo na mesma gravação | `rls/orcamentos` · "rascunho vazio não é enviado; enviado ganha validade e trava o conteúdo" |
| 0.8 | Editor remontava ao mudar a situação e perdia o diálogo do envio | `e2e/regressao/04-orcamentos` · "PDF de rascunho e envio pelo WhatsApp" |
| 0.9 | Valor em mensagem de erro do banco saía no formato do servidor, não em R$ brasileiro | `rls/recibos` · "saldo do orçamento: sinal, valor acima do saldo recusado…" |
| 0.9 | Ficha do cliente mostrava pago/em aberto trocados | `e2e/regressao/05-recibos` · "ficha do cliente: pago e em aberto" |

## Desde a regra (24/10/2026)

| data | erro | onde apareceu | teste que trava | correção |
|---|---|---|---|---|
| 24/10/2026 | `?volta=/\evil.example` (ou com tab) passava pela trava do login e mandava para outro site depois de entrar | auditoria (M1) | `unit/destino` + `e2e/regressao/06-seguranca` | `lib/destino.ts` |
| 24/10/2026 | Next 16.3.8 com DoS sem login pelas Server Actions (GHSA-p3m5-59mp-jv5r) | auditoria (M2) | `unit/dependencias` | Next 16.4.3 |
| 24/10/2026 | Cookie da sessão legível pelo JavaScript da página e válido por 400 dias | auditoria (B4) | `e2e/regressao/06-seguranca` · cookie | `lib/config.ts` |
| 24/10/2026 | A 1ª correção do B4 não valia para a validade: a `@supabase/ssr` grava a sessão sempre com 400 dias e ignora `cookieOptions.maxAge` | `e2e/regressao/06-seguranca` (o teste do B4 falhou) | `e2e/regressao/06-seguranca` · cookie | `comValidade()` em `lib/config.ts`, aplicado em `lib/supabase/server.ts` e `proxy.ts` |
| 24/10/2026 | Sem cabeçalhos de segurança (moldura de outro site, nosniff, Referer com o token do orçamento) | auditoria (B5) | `e2e/regressao/06-seguranca` · cabeçalhos | `next.config.ts` |
| 24/10/2026 | View `saldos_orcamentos` com TRUNCATE/TRIGGER/REFERENCES para anon e authenticated; MAINTAIN e setval em todo objeto | `rls/cobertura` (teste novo) | `rls/cobertura` | migração `20261027090000_seguranca` |
| 24/10/2026 | Pedido de correção pela API direta aceitava anexo `<id>/../../<rota>`, `criada_em` forjada, motivo sem limite e pedido duplicado | auditoria (B1, B2) | `rls/seguranca` | migração `20261027090000_seguranca` |
| 24/10/2026 | Seed de dev rodaria numa VPS com Supabase no loopback e trocava a senha de quem já existia | auditoria (B7) | `unit/seed` | `scripts/seed-dev.ts` |
| 24/10/2026 | Senha do login sem rótulo para leitor de tela: o botão "Esqueci minha senha" dentro do `<label>` roubava o rótulo (a mesma armadilha da 0.6) | smoke · `/login` | smoke · "campo sem rótulo" (toda tela) | `app/login/formulario.tsx` |
| 24/10/2026 | No celular, o nome do ambiente do orçamento ficava com ~20 px (flex-1 + min-w-0 = base 0, a linha não quebrava) | revisão das fotos do smoke | smoke · "campo espremido" (conferência nova, toda tela) | `components/vendas/editor/editor-orcamento.tsx` |
| 24/10/2026 | `ERR_NO_BUFFER_SPACE` do Windows numa rodada longa do smoke (portas esgotadas; não é defeito da tela) | smoke · `/ponto/semana` | — (ambiente) | uma segunda tentativa só para esse erro, anotada no relatório |
| 24/10/2026 | Empresa, regra de ponto e feriados nacionais moravam no `seed.sql`, que não roda em produção: na VPS o banco subiria sem regra nem feriado | preparação da 1.0 | `rls/referencia` | migração `20261028090000_producao` |
| 24/10/2026 | A gestora fechava/reabria semana e mexia na fotografia direto pela API (sem motivo, sem evento, fora de ordem) | auditoria (I2) | `rls/seguranca` · "fechamento só pelas funções" | gatilho `protege_fechamento` |
| 24/10/2026 | Login sem limite de tentativas no app (o Auth só vê o IP do servidor Next) | auditoria (B6) | `unit/limite` + `e2e/regressao/06-seguranca` · login | `lib/limite.ts` |
| 24/10/2026 | Trocar a senha já logada não pedia a senha atual (celular desbloqueado bastava) | auditoria (B6) | `e2e/regressao/06-seguranca` · trocar a senha | `app/definir-senha/acoes.ts` |
| 24/10/2026 | Migração: inserir feriado repetido em semana fechada falhava (o gatilho dispara antes do `on conflict`) | aplicar a migração no banco de teste | `rls/referencia` | `where not exists` na migração |
| 24/10/2026 | Gatilho de fechamento lia `new.status` em tabela sem essa coluna (PL/pgSQL avalia os dois lados do `and`) | `rls/seguranca` | `rls/seguranca` · "continua valendo" | `if` aninhado |
| 24/10/2026 | Testes usavam `current_date` (UTC) como hoje: depois das 21h de Brasília falhavam 7 testes de banco e 2 de navegador | suíte contra o container, às 21h | os próprios testes (rodados depois das 21h) | `HOJE` / `HOJE_SQL` no fuso da loja |
| 24/10/2026 | Restauração devolvia os arquivos do Storage sem os atributos estendidos: todo download restaurado dava 500 | ensaio de restauração + smoke no banco restaurado | `scripts/ensaiar-restauracao.sh` (baixa um PDF restaurado) | GNU tar com `--xattrs` em `deploy/backup/` |
| 24/10/2026 | Teste do limite de login dependia de servidor recém-aberto (o limitador lembra 15 min) | suíte com `E2E_REUSAR=1` | `e2e/regressao/06-seguranca` · login | login único por rodada |
| 25/10/2026 | Teste do limite de login não esperava a resposta de cada tentativa: na CI (mais lenta) a senha seguinte era digitada antes de o formulário se limpar e o envio saía vazio | CI no GitHub (2ª execução) | `e2e/regressao/06-seguranca` · login | espera a resposta e a limpeza dos campos |
| 25/10/2026 | O link da primeira gestora (`scripts/producao.ts`) e o do e-mail de senha nova saíam sem `type=recovery`: a tela mostrava "Link incompleto" | teste de navegador do e-mail de senha nova | `unit/link-senha` + `e2e/regressao/06-seguranca` · e-mail | `lib/link-senha.ts` (um montador só) |
| 25/10/2026 | `/api/saude` dava "banco: false" com tudo de pé: o gateway do Supabase oficial bloqueia a raiz `/rest/v1/` ao anônimo | ensaio da VPS (Supabase oficial local) | smoke · `/api/saude` (200 = tudo de pé) + ensaio | consulta a função pública `orcamento_publico` |
| 25/10/2026 | `supabase db push --db-url` falha com TLS contra o Postgres oficial ("server refused TLS"), mesmo com `sslmode=disable` | ensaio da VPS | — (roteiro) | `migration up --db-url …?sslmode=disable` no `deploy/README.md` |
| 25/10/2026 | O `tsc` (e o build) quebrava em máquina onde o roteiro da VPS rodou: o `tsconfig` pegava as funções de exemplo do Supabase baixado em `deploy/supabase/docker` | ensaio da VPS | `npx tsc --noEmit` na CI e aqui | `deploy` e `.ambiente-teste` fora do `tsconfig` e do ESLint |
| 25/10/2026 | O compose de produção se chamava "cristinas", o mesmo projeto que o Supabase CLI marca nos containers do banco local: um `down` nele mexeria no banco de uso | desmontagem do ensaio da VPS | — (nome) | projeto `cristinas-producao` |
| 25/10/2026 | O endereço e a chave do Supabase eram embutidos no build (`process.env.NEXT_PUBLIC_…`): a imagem ficava presa a um ambiente | ensaio da VPS (imagem genérica) | `unit/config` | `lib/config.ts` lê quando o servidor sobe |
