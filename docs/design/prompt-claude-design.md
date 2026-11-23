# Sistema de gestão — Cristinas Decorações

## Contexto

Você vai desenhar o sistema web interno da **Cristinas Decorações**, uma empresa pequena que vende, confecciona e instala **cortinas e persianas sob medida**. A equipe tem cerca de 5 funcionárias na produção, e quem administra tudo é a dona. Hoje cada coisa vive num lugar diferente (planilha, papel, WhatsApp e um script de ponto que roda em um único computador). O sistema junta tudo em um lugar, com login.

São três módulos:

1. **Orçamentos**: montar orçamentos de cortinas e persianas por ambiente, com medidas e cálculo automático, e enviar ao cliente em PDF ou por WhatsApp.
2. **Recibos**: emitir recibos dos pagamentos dos clientes (sinal, parcelas e quitação), ligados ao orçamento aprovado.
3. **Ponto e RH**: importar o arquivo da catraca biométrica, validar as batidas, corrigir o que estiver errado, controlar o banco de horas e fechar a semana.

O módulo de Ponto é o mais importante e o mais complexo. Capriche nele.

## Quem usa (cada perfil vê só o que pode)

O acesso é controlado no banco de dados, linha a linha. A interface precisa deixar claro o que cada perfil vê e faz:

| Perfil | Onde usa | O que faz |
|---|---|---|
| Gestora (dona) | computador e celular | Tudo: orçamentos, clientes, recibos, ponto, equipe e configurações. Aprova correções de ponto e fecha a semana. |
| Funcionária | celular | Vê só o próprio ponto, o próprio saldo de horas e os próprios espelhos. Pede correção de batida. Não vê nada de outras pessoas nem dos outros módulos. |
| Contador(a) | computador | Só leitura: relatórios de RH (fechamentos, saldos, espelhos) e recibos. Não edita nada. |

Cada perfil tem a própria navegação. Inclua no protótipo um seletor de perfil (só para demonstração) para alternar entre as três visões.

## Identidade visual

- Use o **logo e as cores anexados** como fonte de verdade. A partir deles, monte os tokens de cor (primária, neutros, superfícies) e as cores de estado (sucesso, atenção, erro, informação), de forma que convivam com a marca.
- Tom: ateliê de decoração, cuidadoso e acolhedor, mas é uma ferramenta de trabalho do dia a dia. Legibilidade e densidade de informação vêm antes de efeito decorativo.
- Apenas tema claro.
- Horas e valores em dinheiro com algarismos tabulares, para alinharem em coluna.
- Status nunca só por cor: sempre cor + ícone + texto.
- Contraste mínimo AA. No celular, alvos de toque com pelo menos 44 px.

## Idioma e formatos

- Tudo em português do Brasil.
- Datas `dd/mm/aaaa`. Horários `HH:MM` (24 h).
- Durações em `HH:MM` nas tabelas (`08:57`) e como `8h57` em texto corrido.
- Dinheiro `R$ 1.234,56`.
- Medidas em metros com vírgula (`2,80 m`); no celular, a entrada é em centímetros.

## Tecnologia (para o código que você gerar)

React + TypeScript + Tailwind CSS, componentes no estilo shadcn/ui, ícones lucide-react. O app final será em Next.js, então organize em componentes reutilizáveis e evite bibliotecas além dessas. Use dados fictícios, sem chamadas reais.

---

## Telas

### 1. Acesso

- Login: campo "E-mail ou usuário" + senha, e "Esqueci minha senha". Funcionárias podem não ter e-mail; nesse caso a gestora cria um usuário para elas.
- Primeiro acesso por convite: definir a senha.
- Tela de "sem permissão", para quando alguém abre um link que não é do seu perfil.

### 2. Início da gestora

Um painel que responde "o que precisa da minha atenção hoje":

- Pendências do ponto da semana (destacando quantas bloqueiam o fechamento) e solicitações de correção das funcionárias aguardando resposta.
- Orçamentos enviados aguardando resposta e os que vencem nos próximos dias.
- Valor a receber dos orçamentos aprovados (saldo em aberto).
- Funcionárias perto de fechar a hora de corte do banco de horas.

Cada cartão leva à tela correspondente.

### 3. Clientes

- Lista com busca (nome, telefone, bairro).
- Ficha do cliente: contato, WhatsApp, endereços (residência e endereço da obra podem ser diferentes), histórico de orçamentos e recibos, total pago.

### 4. Orçamentos

**Lista**: número, cliente, data, validade, valor e status (Rascunho, Enviado, Aprovado, Recusado, Vencido). Para os aprovados, a situação do pagamento (Pendente, Parcial, Quitado). Filtros por status e período.

**Editor de orçamento** (a tela central do módulo):

- Cabeçalho: cliente (busca ou cadastro rápido), endereço da obra, data, validade, prazo de entrega e condições de pagamento (ex.: 50% de sinal e 50% na instalação).
- Itens agrupados por **ambiente** (Sala, Quarto do casal, Escritório…). Cada ambiente tem um ou mais itens.
- Cada item: tipo de produto (cortina de tecido, persiana, trilho/varão, acessório, serviço), modelo (ex.: prega wave, prega americana, ilhós; persiana rolô, double vision, romana, horizontal), tecido ou material do catálogo, cor, acionamento (manual ou motorizado), **largura × altura** do vão e quantidade.
- **Cálculo automático com a memória de cálculo visível**: o usuário vê como cada valor foi formado. As regras exatas serão configuradas depois; use estas como exemplo:
  - Tecido: largura × fator de franzimento (ex.: 2,5) = metros de tecido × preço por metro
  - Confecção: por metro de tecido
  - Trilho ou varão: (largura + sobra, ex.: 20 cm) × preço por metro
  - Persiana: largura × altura = m², com área mínima cobrada (ex.: 1,5 m²) × preço por m²
  - Instalação: por vão
  - Exemplo de memória exibida: "Tecido: 3,20 m × 2,5 = 8,00 m × R$ 89,90 = R$ 719,20"
- Rodapé com subtotal por ambiente, desconto (% ou R$), taxa de deslocamento e o **total sempre visível** (fixo na lateral no desktop, barra inferior no celular).
- Observações para o cliente e observações internas (estas não saem no PDF).
- Ações: salvar rascunho, duplicar item ou ambiente, pré-visualizar, enviar.
- **Versão celular para a visita técnica**: a gestora mede as janelas na casa da cliente e lança na hora. Fluxo rápido: ambiente → item → largura e altura em centímetros com teclado numérico → próximo. Precisa funcionar bem com uma mão só.

**Visualização e PDF do orçamento** (A4): logo e dados da empresa, cliente e endereço da obra, itens por ambiente com medidas e valores, total, condições de pagamento, validade, prazo e espaço para aceite. Ações: baixar PDF, copiar link, enviar por WhatsApp.

**Opcional, se couber:** página pública do orçamento (sem login, aberta pelo link), em que a cliente vê o orçamento no celular e toca em "Aprovar orçamento".

**Catálogo de produtos e preços**: tecidos, persianas, trilhos, acessórios e serviços, com unidade (m, m², unidade, vão), preço, largura do rolo (para tecidos), ativo/inativo e a regra de cálculo de cada tipo.

### 5. Recibos (pagamentos de clientes)

- **Lista**: número sequencial, data, cliente, orçamento vinculado, valor, forma de pagamento (PIX, dinheiro, cartão, transferência) e status (Emitido, Cancelado).
- **Emitir recibo** a partir do orçamento aprovado: mostra o total do orçamento, quanto já foi pago e o saldo restante. A gestora escolhe o tipo (sinal, parcela, quitação), o valor, a forma de pagamento e a data. O valor por extenso é preenchido automaticamente. Também é possível emitir recibo avulso, sem orçamento.
- **Recibo impresso** (meia folha A4, com opção de duas vias: cliente e empresa): "RECIBO Nº 0042 — R$ 1.500,00. Recebi de [cliente] a importância de mil e quinhentos reais, referente ao sinal do orçamento nº 0118 (cortinas da sala e do quarto). [Cidade], [data]." Assinatura e dados da empresa.
- Cancelar um recibo exige motivo. O número não é reaproveitado, e o recibo cancelado continua na lista, marcado como cancelado.

### 6. Ponto e RH (o módulo principal)

**Como funciona hoje** (o sistema novo substitui isto): uma catraca biométrica gera um arquivo de texto com as batidas: ID da funcionária, data e hora, e um código de tipo (entrada, saída para almoço, volta do almoço, saída). Um script calcula horas trabalhadas e extras por semana, de segunda a sexta. A jornada é de 9 h de segunda a quinta e 8 h na sexta, com 1 h de almoço.

Existe um **banco de horas semanal**: saldo anterior + extras da semana = acumulado. Quando o acumulado chega à **hora de corte (8 h, com tolerância de 10 min)**, a funcionária ganha **1 dia pago**, e o que passar das 8 h segue para a semana seguinte.

**O sistema novo não só guarda as batidas: ele valida.** Interpreta cada batida, aponta o que está errado, sugere a correção e deixa a gestora decidir. Dois casos reais que o desenho precisa acomodar:

- **Batida faltando.** Bruna, segunda 02/02: batidas às 07:01, 12:19 e 17:00. O script antigo trata 17:00 como "volta do almoço" e conta só a manhã (5h18). O certo é entender que 17:00 é a saída (pelo horário e pelo código da catraca) e abrir a pendência **"Faltou a volta do almoço"**, com três opções: informar o horário; aplicar o almoço padrão de 1 h (volta às 13:19, registrada como ajuste); ou manter como está, com justificativa.
- **Código de tipo errado.** Na maior parte dos dias as funcionárias apertam o botão errado na catraca (ex.: a saída para o almoço fica registrada como "volta"). O sistema corrige isso sozinho pelo horário. **Isso não pode virar pendência**, senão a fila se enche de ruído. No máximo, um aviso discreto no detalhe do dia: "tipo corrigido automaticamente".

Telas do módulo:

**6.1 Importar arquivo da catraca**

- Arrastar ou escolher o arquivo `.txt`.
- Prévia antes de confirmar: período detectado, semanas abrangidas, batidas lidas, quantas são novas e quantas já tinham sido importadas (o mesmo arquivo pode ser importado de novo sem duplicar), funcionárias encontradas, **IDs desconhecidos** (vincular a uma funcionária ou ignorar) e linhas com erro.
- Depois de confirmar: resumo da validação ("22 dias OK, 3 pendências, 2 avisos"), com atalho para a semana.

**6.2 Semana (a visão principal do RH)**

- Seletor de semana e status da semana: **Aberta** → **Pronta para fechar** (sem pendências bloqueantes) → **Fechada** (travada).
- Grade: linhas = funcionárias; colunas = segunda a sexta (e sábado ou domingo, se houver batida nesses dias). Cada célula mostra as horas trabalhadas e um selo de situação: OK, Pendência, Aviso, Ajustado, Falta, Falta justificada / Atestado, Feriado, Folga.
- Ao lado ou abaixo, o resumo do banco de horas da semana por funcionária: saldo anterior, extras da semana, acumulado, quanto falta para a hora de corte, e "fechou a hora de corte" em destaque.
- Clicar numa célula abre o detalhe do dia.
- Botão "Fechar semana", desabilitado enquanto houver pendência bloqueante, explicando o motivo.

**6.3 Pendências (fila de revisão)**

Lista de tudo que a validação encontrou, por severidade:

- **Bloqueia o fechamento:** batida faltando, número ímpar de batidas, batida que não dá para classificar com segurança, ID desconhecido.
- **Aviso (não bloqueia):** almoço menor que 1 h, mais de 2 h extras no dia, intervalo menor que 11 h entre um dia e o seguinte, atraso ou saída antecipada além da tolerância, batidas duplicadas com poucos minutos de diferença (unificadas automaticamente), mais de 4 batidas no dia, batida em fim de semana ou feriado.

Cada pendência mostra a funcionária, o dia, o que aconteceu em linguagem simples, a **sugestão do sistema** e ações rápidas (aceitar sugestão, ajustar manualmente, justificar, marcar falta). Permitir resolver várias de uma vez quando a sugestão for a mesma.

**6.4 Detalhe do dia** (painel lateral ou modal)

- **Linha do tempo do dia** (ex.: das 06:00 às 20:00), com as batidas como marcadores e os períodos de manhã, almoço e tarde como barras; a carga esperada do dia aparece como referência.
- Cada batida mostra a origem: catraca, manual ou ajustada. Quando uma batida foi alterada, o **valor original da catraca continua visível** (riscado, com "original: 17:00"). A batida original nunca é apagada.
- Cálculo explicado em uma linha: "Manhã 5h12 + tarde 3h48 = 9h00 · carga 9h00 · extra 0h00".
- Ações: adicionar batida, editar horário, desconsiderar batida, trocar o tipo, lançar ocorrência (atestado, falta justificada, folga, feriado). **Toda alteração exige motivo.**
- Histórico do dia: quem alterou, quando, e de quê para quê.

**6.5 Solicitações de correção** (vindas das funcionárias)

Fila com dia, batida, horário pedido, motivo e anexo (ex.: foto do atestado). A gestora aprova (vira um ajuste com o motivo da funcionária) ou recusa (com uma resposta).

**6.6 Banco de horas**

Por funcionária: saldo atual, histórico semana a semana (gráfico de linha simples do acumulado, com a linha da hora de corte), dias pagos por ter fechado a hora de corte e ajustes manuais de saldo (com motivo).

**6.7 Fechamento da semana**

Checklist (pendências zeradas, solicitações respondidas) e resumo por funcionária. Ao confirmar: trava a semana, gera o **espelho de ponto em PDF** de cada funcionária e permite exportar a planilha `.xlsx` da semana. Só a gestora reabre uma semana fechada, e com motivo.

**6.8 Espelho de ponto** (PDF A4, um por funcionária por semana)

Cabeçalho com logo, nome e período. Tabela dos 5 dias (data, entrada, saída para almoço, volta do almoço, saída, horas trabalhadas, extras), com dias de falta destacados e ajustes sinalizados. Bloco do banco de horas (saldo anterior, extras da semana, acumulado, próxima semana, hora de corte). Data de geração e espaço para a assinatura da funcionária.

**6.9 Equipe**

Cadastro: nome, nome de exibição, ID na catraca, jornada (segunda a quinta e sexta), ativa/inativa e acesso ao sistema (criar usuário, reenviar convite, bloquear).

**6.10 Calendário e regras**

- Feriados: nacionais já carregados; municipais e pontes cadastrados pela gestora.
- Regras editáveis: carga por dia da semana, almoço padrão, hora de corte e tolerância, tolerância de atraso e a janela de tempo para considerar batidas duplicadas.

### 7. Portal da funcionária (celular)

- **Meu ponto**: semana atual, dia a dia, com as horas e o selo de situação; navegação para as semanas anteriores.
- **Meu banco de horas**: barra de progresso até a hora de corte ("6h53 de 8h00"), em linguagem simples: "faltam 1h07 para ganhar um dia".
- **Minhas pendências**: "Você esqueceu de bater a volta do almoço em 02/02. Informe o horário." O toque abre a solicitação já preenchida.
- **Pedir correção**: dia, qual batida, horário, motivo e foto opcional.
- **Minhas solicitações**: pendente, aprovada ou recusada (com a resposta da gestora).
- **Meus espelhos**: lista dos PDFs semanais para baixar.

### 8. Visão do contador (somente leitura)

Relatórios de RH (semanas fechadas, espelhos, banco de horas, exportação `.xlsx`) e lista de recibos com exportação. Selo "Somente leitura" visível e nenhum botão de edição.

### 9. Configurações (gestora)

- Dados da empresa usados nos PDFs: nome, CNPJ, endereço, telefone/WhatsApp, chave PIX e logo.
- Usuários e perfis: convidar, mudar perfil, desativar.
- Numeração de orçamentos e recibos.

---

## Estados e detalhes que precisam aparecer

- Estados vazios (primeiro uso: "Importe o primeiro arquivo da catraca"), carregando, erro e sem permissão.
- Confirmação antes de ações irreversíveis (fechar semana, cancelar recibo).
- Mensagens de sucesso curtas (toast).
- Busca e filtros nas listas; paginação simples.

## Dados de exemplo

Use dados fictícios e realistas: 5 funcionárias (Ana Paula, Bruna, Cláudia, Denise, Elaine), clientes com bairros de uma cidade brasileira, orçamentos entre R$ 800 e R$ 15.000, e batidas por volta das 07:00, 12:15, 13:15 e 17:00 (16:00 na sexta), com algumas pendências espalhadas pela semana.

## Fora do escopo (não desenhar)

Estoque, nota fiscal, folha de pagamento completa, contas a pagar, agenda de instalação.

## Entregáveis

1. Página do design system: cores, tipografia, espaçamentos e componentes (botões, campos, tabela, selos de status, cartões de indicador, linha do tempo do dia, grade da semana).
2. Protótipo navegável com todas as telas acima e o seletor de perfil.
3. Desktop em 1440 px para as telas da gestora e do contador. Celular em 390 px para: login, portal da funcionária inteiro, editor de orçamento (visita técnica), emitir recibo e início da gestora.
4. Layouts de impressão A4: orçamento, recibo e espelho de ponto.

Se precisar priorizar, siga esta ordem: (1) Ponto: semana, pendências e detalhe do dia; (2) editor de orçamento; (3) recibos; (4) portal da funcionária; (5) o restante.
