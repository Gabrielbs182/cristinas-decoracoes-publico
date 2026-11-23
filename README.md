# Cristina's Decorações — controle de ponto e gestão

> **Micro-capstone · Pós-graduação em Engenharia de IA Aplicada.** Projeto feito para um problema real de uma
> empresa real. Esta é uma cópia pública do código (versão 0.11.1, num commit só); o desenvolvimento segue num
> repositório privado. **Não há dado real aqui:** o cadastro das funcionárias, os arquivos do relógio de ponto e o
> histórico ficam fora do git, e o sistema sobe com nomes fictícios (`scripts/dados-exemplo/`).

## O problema real

A Cristina's Decorações é uma empresa pequena de cortinas e persianas sob medida, com cinco funcionárias. A presença
é registrada num **relógio de ponto (catraca)** que não oferece relatório nem gestão que sirvam para o dia a dia:

- **Ele só exporta um arquivo de texto bruto** (`GLog.txt`): uma linha por batida, com o número da funcionária e
  o horário. Não diz quantas horas cada uma trabalhou, não fecha a semana e não controla banco de horas.
- **Ele não confia nem no que registra.** O campo em que o relógio diz se a batida é entrada, almoço ou saída
  estava **errado em 17 de 25 dias** conferidos com a realidade. Uma batida esquecida ou repetida desloca todas as
  outras do dia.
- **Ele não conhece as regras da empresa.** Jornada de 9 h de segunda a quinta e 8 h na sexta, almoço de 1 h, banco
  de horas semanal em que cada 8 h acumuladas viram 1 dia pago, almoço curto que não gera crédito, dia abaixo da
  carga que não desconta, fim de semana e feriado fora do banco.

Antes deste sistema, a gestão era um script em Python, que lia o arquivo e gerava uma planilha e um PDF por
funcionária por semana. Ele resolvia a conta, mas deixava o resto na mão de alguém:

- O saldo de uma semana passava para a seguinte **copiando um CSV à mão**.
- Ausência justificada, falta e atestado eram **anotados à mão** na planilha.
- **Correção não deixava rastro:** quem mudou qual batida, quando e por quê.
- Batida faltando ou duplicada entrava na conta **sem aviso** e só aparecia quando o saldo já estava errado.
- **A funcionária não via o próprio banco de horas**, e o contador recebia arquivos soltos.

## O que o sistema faz

Um sistema web (computador da gestora e celular das funcionárias) que **valida o ponto em vez de só somar**:

1. **Importa o arquivo do relógio** com prévia antes de gravar, sem duplicar batidas.
2. **Aponta o que está errado:** batida faltando (entrada, almoço ou saída), batida repetida, almoço curto,
   atraso, saída antecipada, intervalo curto entre jornadas, batida em fim de semana ou feriado. Quando dá, sugere a
   correção; a classificação usa o horário, não o campo do relógio, que não é confiável.
3. **A gestora resolve as pendências** (aceitar a sugestão, justificar, marcar falta, inclusive em lote) e **a
   funcionária pede correção pelo celular**, com motivo e foto do atestado.
4. **Toda correção fica registrada:** a batida original nunca é apagada nem alterada, e cada ajuste é uma linha
   nova com autor, data e motivo.
5. **Fechamento da semana** travado no banco de dados, com espelho de ponto em PDF (espaço para assinatura) e a
   planilha no mesmo layout que a empresa já usava. Reabrir exige motivo.
6. **Banco de horas** semana a semana, com dias pagos e ajustes; a funcionária vê o dela, e o contador acessa
   tudo só para leitura.

As 34 semanas já apuradas pelo script antigo (fevereiro a setembro de 2026) foram importadas, e **o saldo final bate
com o do sistema antigo**. Além do ponto, que é o centro do projeto, o sistema tem dois módulos menores:
orçamentos (com cálculo de tecido e persiana e link para a cliente aprovar) e recibos de pagamento.

## Decisões de análise e projeto

- **Conta igual à antiga, validação separada.** A conta das horas é uma tradução fiel do script antigo e foi
  conferida dia a dia contra ele (**100% idêntica em 50 de 50 dias reais**). A validação é uma camada à parte, que
  aponta e sugere, mas nunca muda a conta sozinha. Assim a mudança de sistema não altera o salário de ninguém sem que
  a gestora veja.
- **Não confiar no relógio.** O campo de tipo de batida é exibido, mas não usado: o erro medido (17 em 25 dias)
  tornava qualquer regra baseada nele errada na maior parte do tempo.
- **Rastro em vez de edição.** Ponto é documento trabalhista: batida imutável e correções só por acréscimo, com
  motivo, garantidas por gatilhos no próprio banco (nem um script com acesso total consegue reescrever o passado).
- **Segurança no banco, não só na tela.** Três perfis (gestora, funcionária, contador) com regras de acesso no
  Postgres (RLS). Um teste lê o catálogo do banco e reprova qualquer tabela ou permissão nova que não tenha sido
  revisada.
- **As regras de negócio foram confirmadas com a empresa, não com o protótipo.** O protótipo visual supunha o
  contrário em três regras (almoço curto, dia abaixo da carga e feriado); valeu o que a gestora confirmou.
- **Infraestrutura do tamanho da empresa.** Supabase em self-hosting numa VPS pequena (cerca de 0,5 GB de 4 GB em
  uso), com a cópia de segurança diária preparada e a restauração ensaiada de ponta a ponta.

## Como foi construído

O sistema foi desenvolvido com um assistente de programação com IA (Claude Code). O [CLAUDE.md](CLAUDE.md) funciona
como a memória do projeto: as regras de negócio confirmadas, as decisões de arquitetura e as armadilhas já
encontradas, para que cada sessão parta do que já se sabe. A regra é que **todo erro encontrado vira um teste** antes
de ser dado como corrigido ([tests/REGRESSOES.md](tests/REGRESSOES.md)), e um agente de QA percorre todas as telas
com cada perfil, no computador e no celular, procurando erros.

## Estado

Versão 0.11.1: 60 de 65 entregas feitas. O que falta para a 1.0 é pôr o sistema no ar na VPS
([ROADMAP.md](ROADMAP.md) e o roteiro em [deploy/README.md](deploy/README.md)).

**Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres com RLS, Auth e Storage), Tailwind, pdfkit e exceljs
para os impressos, Vitest e Playwright para os testes, Docker e Caddy para a implantação.

## Rodar localmente

Precisa de Node.js e do Docker aberto.

```powershell
npm install
npx supabase start
npx tsx --env-file=.env.development.local scripts/seed-dev.ts   # usuários e cadastro de exemplo
npm run dev   # http://127.0.0.1:3100
npm test      # unidade + banco (RLS, permissões), no Supabase de teste (573xx)
npm run e2e   # regressão no navegador (ambiente de teste isolado, app na 3300)
npm run smoke # todas as telas × todos os perfis
```

Copie o `.env.example` para `.env.development.local` antes (as chaves locais aparecem no `npx supabase start`).
Detalhes de cada módulo, regras e decisões: [CLAUDE.md](CLAUDE.md).
