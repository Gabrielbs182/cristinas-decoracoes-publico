/**
 * Guia rápido de uso (telas /ajuda e /meu-ponto/ajuda). Linguagem de quem usa; os nomes dos botões são os da tela.
 * O teste tests/unit/guia.test.ts confere que todo link daqui aponta para uma tela que existe.
 */
export interface Topico {
  titulo: string;
  onde?: { rotulo: string; href: string };
  passos: string[];
  dica?: string;
}

export const GUIA_GESTORA: Topico[] = [
  {
    titulo: "Toda semana: do arquivo da catraca ao fechamento",
    onde: { rotulo: "Importar arquivo", href: "/ponto/importar" },
    passos: [
      "Exporte o arquivo da catraca (o .txt do GLog) e abra em Importar arquivo. Confira a prévia e toque em Confirmar importação. Importar o mesmo arquivo de novo não duplica nada: entra só o que é novo.",
      "Em Pendências, resolva o que bloqueia (em vermelho): aceite a sugestão ou informe o horário certo. Pendências do mesmo tipo se resolvem juntas: marque uma e use “Selecionar as … deste tipo”.",
      "Avisos (em amarelo) não impedem o fechamento: só confira.",
      "Em Solicitações, responda os pedidos das funcionárias. Aprovar lança a correção do jeito que ela pediu; para recusar, escreva a resposta para ela.",
      "Em Fechamento, confira a lista e toque em Fechar semana. Saem o espelho de ponto em PDF de cada funcionária e a planilha da semana para o contador, e os saldos seguem para a semana seguinte.",
    ],
    dica: "Fechou com erro? Reabrir semana desfaz o fechamento — só a última semana fechada, e com o motivo.",
  },
  {
    titulo: "Banco de horas",
    onde: { rotulo: "Banco de horas", href: "/ponto/banco" },
    passos: [
      "O que passa da jornada de cada dia soma no banco. Ao chegar a 8 horas (com 10 minutos de tolerância), a funcionária ganha 1 dia pago e o que sobrou continua no banco.",
      "Dia abaixo da jornada não desconta. Almoço menor que 1 hora conta como 1 hora. Sábado, domingo e feriado ficam fora do banco.",
      "Precisa corrigir um saldo? Em Banco de horas, escolha a funcionária e use “Ajustes manuais de saldo” (somar ou descontar, sempre com o motivo).",
    ],
  },
  {
    titulo: "Equipe e acessos",
    onde: { rotulo: "Equipe", href: "/ponto/equipe" },
    passos: [
      "Nova funcionária: nome, nome de exibição e o ID da catraca (o número dela no relógio de ponto).",
      "Criar acesso gera um link: mande pelo WhatsApp. Ela abre no celular, cria a senha e já entra. O link vale 24 horas e serve uma vez só.",
      "Esqueceu a senha ou perdeu o celular da verificação em duas etapas? Redefinir senha gera um link novo e desliga a verificação (ela liga de novo depois, se quiser).",
      "Bloquear tira o acesso na hora (e Desbloquear devolve). Desligar, em Editar, tira da lista e bloqueia o acesso; ela continua nas semanas em que trabalhou.",
    ],
    dica: "O nome que aparece no ponto é a própria funcionária que escolhe, no perfil dela.",
  },
  {
    titulo: "Feriados e regras do ponto",
    onde: { rotulo: "Calendário e regras", href: "/ponto/calendario" },
    passos: [
      "Os feriados nacionais já vêm cadastrados. Municipais, pontes e pontos facultativos: preencha a data e o nome e toque em Adicionar.",
      "Mudar as regras (horários, tolerâncias) vale a partir da primeira semana ainda não fechada: o que já foi fechado não muda.",
    ],
  },
  {
    titulo: "Orçamentos",
    onde: { rotulo: "Orçamentos", href: "/orcamentos" },
    passos: [
      "Novo orçamento: escolha a cliente (ou Cliente novo, para cadastrar na hora).",
      "Separe por ambiente (sala, quarto…) e lance os itens com as medidas do vão: o sistema calcula tecido, confecção, trilho e instalação pelos preços do catálogo. Tudo é salvo sozinho.",
      "Pré-visualizar mostra o PDF. Enviar ao cliente → Marcar como enviado → Abrir o WhatsApp: a mensagem leva o link do orçamento, e a cliente pode aprovar pelo celular.",
      "O preço fica o da época do orçamento: mudar o catálogo depois não muda orçamento já feito.",
    ],
    dica: "A validade conta do envio. Orçamento vencido sem resposta aparece no Início.",
  },
  {
    titulo: "Recibos",
    onde: { rotulo: "Recibos", href: "/recibos" },
    passos: [
      "No orçamento aprovado, Emitir recibo: o sistema sugere o sinal (metade) e, depois, a quitação (o saldo exato).",
      "Pagamento fora de orçamento: recibo Avulso.",
      "O PDF sai em meia folha, com duas vias. Recibo emitido não se altera: se errou, Cancelar (com o motivo) e emita outro.",
      "A planilha .xlsx do mês, para o contador, sai na lista de recibos.",
    ],
  },
  {
    titulo: "Clientes e catálogo",
    onde: { rotulo: "Clientes", href: "/clientes" },
    passos: [
      "Cliente: nome, WhatsApp, CPF ou CNPJ (opcional) e o endereço da obra, se não for na residência.",
      "Em Catálogo e preços ficam tecidos (preço por metro), persianas (por m²), trilhos, acessórios e serviços, e os modelos de confecção. Produto não se apaga: desative.",
    ],
  },
  {
    titulo: "Quem mais acessa a gestão",
    onde: { rotulo: "Configurações", href: "/configuracoes" },
    passos: [
      "Convidar: o contador ou outra gestora, com link pelo WhatsApp (o mesmo jeito das funcionárias).",
      "Aqui também ficam os dados da empresa e o próximo número de orçamento e de recibo.",
    ],
  },
  {
    titulo: "Sua senha e a verificação em duas etapas",
    onde: { rotulo: "Minha conta", href: "/conta" },
    passos: [
      "Trocar senha pede a senha atual. Esqueceu? Se você entra com e-mail, toque em “Esqueci minha senha” no login e receba o link por e-mail; senão, outra pessoa da gestão gera um link novo em Configurações.",
      "Verificação em duas etapas (opcional): em Minha conta, ligue e leia o QR code com um app autenticador no celular (Google Authenticator, Microsoft Authenticator…). Daí em diante, o login pede também o código de 6 números do app.",
    ],
  },
];

export const GUIA_CONTADOR: Topico[] = [
  {
    titulo: "Semanas e espelhos",
    onde: { rotulo: "Semanas e espelhos", href: "/rh/semanas" },
    passos: ["Cada semana fechada pela gestora, com o espelho de ponto em PDF de cada funcionária e a planilha .xlsx da semana."],
  },
  { titulo: "Banco de horas", onde: { rotulo: "Banco de horas", href: "/rh/banco" }, passos: ["O saldo de cada funcionária, semana a semana."] },
  {
    titulo: "Recibos",
    onde: { rotulo: "Recibos", href: "/recibos" },
    passos: ["Os recibos do mês, o PDF de cada um e a planilha .xlsx do mês."],
  },
  {
    titulo: "Somente leitura",
    passos: [
      "Você vê e exporta; quem lança e corrige é a gestora. Para trocar a sua senha: Minha conta → Trocar senha.",
      "Esqueceu a senha? No login, digite o seu e-mail e toque em “Esqueci minha senha”: o link chega por e-mail.",
      "Quer mais proteção? Em Minha conta, ligue a verificação em duas etapas (código de um app no celular).",
    ],
  },
];

export const GUIA_FUNCIONARIA: Topico[] = [
  {
    titulo: "Seu ponto",
    onde: { rotulo: "Ponto", href: "/meu-ponto" },
    passos: ["Aqui estão as suas batidas de cada dia e as horas trabalhadas. Troque de semana pelas setas."],
  },
  {
    titulo: "Pendências",
    onde: { rotulo: "Pendências", href: "/meu-ponto/pendencias" },
    passos: [
      "Quando falta uma batida (por exemplo, a volta do almoço), ela aparece aqui.",
      "Toque em Informar horário, escreva o motivo e toque em Enviar para a gestora.",
    ],
  },
  {
    titulo: "Pedir correção",
    onde: { rotulo: "Pedir correção", href: "/meu-ponto/corrigir" },
    passos: [
      "Escolha o dia e a batida (ou atestado / falta justificada), o horário e o motivo.",
      "Tem atestado? Anexe a foto. A resposta da gestora aparece em Pedidos.",
    ],
  },
  {
    titulo: "Banco de horas",
    onde: { rotulo: "Banco", href: "/meu-ponto/banco" },
    passos: ["Quanto você tem no banco e como chegou ali. Ao chegar a 8 horas, você ganha 1 dia pago."],
  },
  {
    titulo: "Espelhos",
    onde: { rotulo: "Espelhos", href: "/meu-ponto/espelhos" },
    passos: ["O espelho de ponto em PDF de cada semana já fechada pela gestora."],
  },
  {
    titulo: "Seu nome e sua senha",
    onde: { rotulo: "Meu perfil", href: "/meu-ponto/perfil" },
    passos: [
      "Troque o nome que aparece no ponto e para a gestora.",
      "Trocar senha pede a senha atual. Esqueceu a senha? Fale com a Cristina: ela manda um link novo pelo WhatsApp.",
      "Verificação em duas etapas (opcional): ligue aqui e leia o QR code com um app autenticador; daí em diante o login pede também o código do app. Perdeu o celular? A Cristina desliga para você.",
    ],
  },
];
