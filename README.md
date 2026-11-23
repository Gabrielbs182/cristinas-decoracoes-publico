# Cristina's Decorações — sistema de gestão

> **Cópia pública para estudo** (pós-graduação em Engenharia de IA Aplicada). É o código da versão 0.11.1,
> num commit só: o desenvolvimento, a CI e a publicação da imagem seguem num repositório privado. Não há dado real
> aqui: o cadastro das funcionárias, os arquivos da catraca e o histórico ficam fora do git (`dados/`), e o seed usa
> os nomes fictícios de `scripts/dados-exemplo/`.

Sistema web interno de uma empresa de cortinas e persianas sob medida: **ponto e RH** (importa o arquivo da
catraca, valida as batidas, banco de horas), **orçamentos** e **recibos**. Next.js + Supabase (Postgres com RLS).

- O que já existe e o que falta até a 1.0: [ROADMAP.md](ROADMAP.md) (também dentro do sistema, em **Versão e novidades**).
- Como rodar, regras de negócio confirmadas e decisões de arquitetura: [CLAUDE.md](CLAUDE.md).
- Design de referência: [docs/design](docs/design).
- Pôr no ar (VPS, HTTPS, cópia de segurança): [deploy/README.md](deploy/README.md).
- Testes de navegador e o registro de regressões: [tests/REGRESSOES.md](tests/REGRESSOES.md).

```powershell
npm install
npx supabase start
npx tsx --env-file=.env.development.local scripts/seed-dev.ts
npm run dev   # http://127.0.0.1:3100
npm test      # unidade + banco (RLS, permissões) — no Supabase de teste (573xx)
npm run e2e   # regressão no navegador (ambiente de teste isolado, app 3300)
npm run smoke # todas as telas × todos os papéis
```
