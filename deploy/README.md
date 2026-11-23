# Implantação na VPS

Roteiro para pôr o sistema no ar numa VPS própria. Tudo roda em Docker: o **Supabase oficial** (self-hosting,
versão fixada em `deploy/supabase/preparar.sh`, enxuto para 4 GB) e o **app** (a imagem que a CI monta e os
testes conferem) atrás do **Caddy**, que cuida do HTTPS. Só as portas 80 e 443 ficam abertas para a internet; o
Supabase, o Studio e o Postgres respondem só dentro da VPS.

```
internet ──443──▶ Caddy ──▶ app (Next, :3000) ──rede Docker──▶ Supabase (gateway :8000 → auth, rest, storage, db)
                                                     ▲
                    você, por túnel SSH ─────────────┘ 127.0.0.1:8000 (Studio, quando ligado) · 127.0.0.1:5432 (Postgres)
```

**Ensaiado em 25/10/2026**, com o Supabase oficial nesta versão rodando local: migrações, app pela imagem da CI,
primeira gestora pelo link, cadastro, cópia e restauração. Consumo medido: **~490 MB** (Supabase enxuto + app).

## O que foi decidido (25/10/2026)

- **Hostinger KVM 1** (1 vCPU, 4 GB, 50 GB), em São Paulo se aparecer no checkout, **Ubuntu 24.04 puro** (sem
  painel: CloudPanel/cPanel/Coolify ocupariam as portas 80/443). Ajustes para caber com folga: swap de 4 GB, os
  serviços do Supabase que o sistema não usa desligados e a imagem do app montada pela CI (a VPS só baixa).
  Se apertar, sobe para o KVM 2 sem reinstalar.
- **Sem domínio**: o endereço é o nome que a Hostinger dá à VPS (`srv123456.hstgr.cloud`, no hPanel). HTTPS
  continua obrigatório (o login usa cookie seguro). Domínio pode entrar depois sem reinstalar: só trocar
  `APP_URL` e `DOMINIO` no `deploy/.env` (e `SITE_URL` no `deploy/supabase/docker/.env`) e subir de novo.
- **Cópias de segurança fora da VPS no Backblaze B2.**
- **E-mail de senha nova pelo Gmail da loja** (SMTP com senha de app): sem domínio próprio, Resend/Brevo não enviam.

### Hostinger

1. Contrate a VPS **KVM 1** com o modelo **Ubuntu 24.04** (sem painel) e cadastre a sua chave SSH.
2. No hPanel, firewall da VPS: libere só **22, 80 e 443**.
3. Anote o **nome da VPS** (hostname, `srv….hstgr.cloud`) e confira que ele aponta para o IP dela:
   `nslookup srv123456.hstgr.cloud`. Esse nome vai no `APP_URL=https://srv123456.hstgr.cloud`.
4. Na primeira subida, confira se o Caddy conseguiu o certificado (`docker compose -f deploy/docker-compose.yml logs
   caddy`). Se o Let's Encrypt recusar o nome da Hostinger (o limite de emissão é por domínio, e `hstgr.cloud` é
   de todos os clientes dela), as saídas são um certificado para o próprio IP (o Let's Encrypt emite desde jan/2026,
   válido por 6 dias e renovado sozinho) ou um domínio próprio (~R$ 40/ano).

### Backblaze B2

1. Crie um bucket **privado** (ex.: `cristinas-copias`) com "Keep all versions".
2. Crie uma *Application Key* **só para esse bucket**, com leitura e escrita.
3. Na VPS: `rclone config` → novo remoto `b2` do tipo *Backblaze B2* com essa chave. Teste com `rclone ls b2:cristinas-copias`.

### GitHub (imagem do app)

A CI publica a imagem em `ghcr.io/gabrielbs182/cristinas-decoracoes` a cada tag de versão (privada, como o
repositório). Crie um *token* (Settings → Developer settings → Personal access tokens) **só com `read:packages`**
para a VPS baixar.

## 1. Preparar a VPS

```bash
# como root, uma vez
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
# swap de 4 GB: folga para os picos (o KVM 1 tem 4 GB de memória)
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf && sysctl --system
adduser cristinas && usermod -aG docker cristinas      # o resto, como esse usuário
apt install -y git rclone
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs   # para os scripts de carga e as migrações
```

> O Docker publica portas por fora do `ufw`. Por isso o compose do Supabase daqui liga o gateway e o Postgres só
> em `127.0.0.1` (`deploy/supabase/docker-compose.cristinas.yml`): confira com `ss -tlnp` que só 22, 80 e 443
> aparecem em `0.0.0.0`.

## 2. Código e segredos

```bash
git clone git@github.com:Gabrielbs182/cristinas-decoracoes.git ~/sistema && cd ~/sistema   # chave de deploy só leitura
npm ci
APP_URL=https://srv123456.hstgr.cloud deploy/supabase/preparar.sh   # o nome da VPS no hPanel
echo "<token read:packages>" | docker login ghcr.io -u Gabrielbs182 --password-stdin
```

O `preparar.sh` baixa o Supabase oficial na versão fixada, gera **segredos novos** (senha do Postgres, JWT,
chaves) em `deploy/supabase/docker/.env` e `deploy/.env` e aplica os ajustes da Cristina's (portas só locais,
serviços sem uso desligados, link de acesso de 24 h, regra de senha, duas etapas, modelo do e-mail). **Guarde os
dois `.env` num cofre de senhas**: sem eles não se restaura a cópia de segurança. Em `deploy/.env`, troque
`VERSAO=latest` pela tag da versão (ex.: `v0.12.0`) para fixá-la.

Login por e-mail precisa do provedor de e-mail **ligado** (`ENABLE_EMAIL_SIGNUP=true`) com o cadastro público
**desligado** (`DISABLE_SIGNUP=true`) — desligar o primeiro desliga o login (a mesma armadilha do `config.toml`).

### E-mail (Gmail da loja)

Preencha em `deploy/supabase/docker/.env` antes de subir o Supabase:

| variável | valor |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | o e-mail Gmail da loja |
| `SMTP_PASS` | a **senha de app** (16 letras), não a senha da conta |
| `SMTP_ADMIN_EMAIL` | o mesmo e-mail Gmail (o Gmail só envia "de" quem autenticou) |
| `SMTP_SENDER_NAME` | `Cristina's Decorações` |

A senha de app exige a verificação em duas etapas do Google ligada nessa conta (Conta Google → Segurança →
Senhas de app). São poucos e-mails (só quando alguém esquece a senha): o limite diário do Gmail não pesa. Se um
dia houver domínio próprio, Resend ou Brevo entram trocando só essas variáveis.

O modelo do e-mail é o `supabase/templates/recuperar-senha.html`, que o Auth busca no próprio app
(`http://app:3000/modelos/recuperar-senha`). O link dele abre a tela de criar senha do sistema. Só quem entra com
e-mail recebe; as funcionárias (usuário sem e-mail) continuam com o link pelo WhatsApp. Para a Cristina também
recuperar sozinha, crie a gestora com o e-mail dela (`--login=<e-mail>` no passo 5).

## 3. Subir o Supabase e aplicar as migrações

```bash
(cd deploy/supabase/docker && docker compose up -d)     # ~2 min na primeira vez (baixa as imagens)
set -a; . deploy/.env; set +a
npx supabase migration up --db-url "postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres?sslmode=disable"
```

No dia a dia sobem só o gateway, o Postgres, o Auth, o PostgREST e o Storage. As migrações criam tudo, inclusive
empresa, regra de ponto vigente e feriados nacionais até 2030 (o `supabase/seed.sql` não roda em produção).

> Use `migration up` com `?sslmode=disable` (a conexão é dentro da própria VPS). No ensaio, o `db push` falhou com
> "server refused TLS connection" mesmo com `sslmode=disable`.

## 4. Subir o app

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
curl -s https://srv123456.hstgr.cloud/api/saude    # {"ok":true,"versao":"…","auth":true,"banco":true,"arquivos":true}
```

O Caddy emite o certificado sozinho na primeira visita (o nome da VPS precisa apontar para ela; ver "Hostinger", passo 4).

## 5. Primeira carga

```bash
deploy/ferramenta.sh scripts/producao.ts gestora --login=cristina --nome="Cristina"   # mostra o link para ela criar a senha
deploy/ferramenta.sh scripts/producao.ts funcionarias dados/funcionarias.csv          # cadastro (sem logins)
deploy/ferramenta.sh scripts/importar-historico.ts --gestora=cristina                 # só confere
deploy/ferramenta.sh scripts/importar-historico.ts --gravar --gestora=cristina        # grava e reconfere do banco
deploy/ferramenta.sh scripts/anexar-pdfs-legado.ts                                    # espelhos antigos
```

`dados/` (cadastro real, histórico) e os relatórios do sistema antigo não estão no git: copie da sua máquina
(`scp -r dados cristinas@<vps>:~/sistema/` e `scp -r ../Pontos/data cristinas@<vps>:~/Pontos/`, que é onde os
scripts procuram o GLog bruto e os PDFs; `PONTOS_DIR` troca o lugar) e apague os dois da VPS depois da carga.
O acesso de cada funcionária a Cristina cria na tela **Equipe → Criar acesso** (link pelo WhatsApp); o contador,
em **Configurações → Convidar**. Perdeu o link ou o celular das duas etapas? `producao.ts link --login=…` gera
outro (e desliga as duas etapas).

## 6. Cópia de segurança

```bash
sudo mkdir -p /var/backups/cristinas && sudo chown cristinas /var/backups/cristinas
rclone config                                   # cria o remoto de fora da VPS (ex.: "b2")
crontab -e
# todo dia às 3h; guarda 30 dias na VPS e manda uma cópia para fora
0 3 * * * DESTINO_FORA=b2:cristinas-copias /home/cristinas/sistema/deploy/backup/backup.sh >> /var/backups/cristinas/backup.log 2>&1
```

Cada cópia tem os dados do banco (inclusive logins e o índice dos arquivos), os arquivos do Storage (espelhos,
anexos, com os atributos estendidos que o Storage exige), a contagem de linhas de cada tabela e a migração em que
o banco estava.

**Restaurar** (VPS nova ou banco perdido): passos 1 a 4 com os **mesmos `.env` guardados**, as migrações até a
mesma versão da cópia (`migracao.txt`) e então

```bash
CONFIRMO=apagar-e-restaurar deploy/backup/restaurar.sh /var/backups/cristinas/<pasta>
```

que termina conferindo a contagem de cada tabela contra a da cópia. O procedimento é ensaiado de ponta a ponta
pelo `scripts/ensaiar-restauracao.sh` no ambiente de teste (copia, zera o banco, restaura, confere e abre um
arquivo restaurado); refaça o ensaio na VPS a cada atualização do Supabase.

## 7. Acompanhamento

- **Está no ar?** Um monitor externo gratuito (UptimeRobot, Better Stack…) chamando
  `https://<nome da VPS>/api/saude` a cada 5 min, com alerta por e-mail/WhatsApp. Responde 503 se o app não alcança o
  banco, o Auth ou os arquivos.
- **Erros do servidor**: uma linha JSON por erro em `docker compose -f deploy/docker-compose.yml logs app`
  (`"nivel":"erro"`), sem endereço com token nem cookies.
- **Memória e disco**: `free -h` (com tudo no ar, ~0,5 GB em uso de 4 GB), `df -h` e o tamanho de
  `/var/backups/cristinas`. Os logs do app giram sozinhos (5 × 10 MB).

## Atualizar o sistema

```bash
cd ~/sistema && git pull && npm ci              # migrações e scripts novos
set -a; . deploy/.env; set +a
npx supabase migration up --db-url "postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres?sslmode=disable"
# em deploy/.env: VERSAO=<a tag nova>, depois
docker compose -f deploy/docker-compose.yml --env-file deploy/.env pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

Antes de atualizar, confira que a CI do GitHub (aba Actions) está verde na versão. Voltar para a anterior é
trocar `VERSAO` e repetir o `pull` + `up -d` (migração não volta sozinha: desfazer esquema é uma migração nova).

## Studio (painel do Supabase)

Fica desligado no dia a dia (economiza memória). Quando precisar:

```bash
cd ~/sistema/deploy/supabase/docker && docker compose --profile painel up -d studio meta
# na sua máquina: ssh -L 8000:127.0.0.1:8000 cristinas@<vps>  e abra http://127.0.0.1:8000
docker compose stop studio meta                 # ao terminar
```

Usuário e senha: `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` do `deploy/supabase/docker/.env`. Nunca pela internet.
