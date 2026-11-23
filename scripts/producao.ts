/**
 * Primeira carga de um banco NOVO (a VPS): a primeira gestora e o cadastro das funcionárias. Roda na VPS pelo
 * deploy/ferramenta.sh (que aponta para o Supabase de lá). Usa a chave secreta: só para estas tarefas de implantação.
 *
 *   deploy/ferramenta.sh scripts/producao.ts gestora --login=cristina --nome="Cristina"
 *   deploy/ferramenta.sh scripts/producao.ts funcionarias dados/funcionarias.csv
 *   deploy/ferramenta.sh scripts/producao.ts link --login=cristina      # link novo de senha (e desliga as duas etapas)
 *
 * A gestora nasce SEM senha: o comando mostra o link (vale 24 h) para ela criar a dela. Funcionária entra só no
 * cadastro (com o ID da catraca, para o histórico casar); o acesso de cada uma a gestora cria na tela Equipe.
 */
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { apagarFatores } from "../lib/duas-etapas";
import { montarLinkDeSenha } from "../lib/link-senha";

const [comando, ...resto] = process.argv.slice(2);
const opcao = (nome: string) => resto.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const APP_URL = process.env.APP_URL ?? "";
const dominio = process.env.USUARIOS_DOMINIO_INTERNO ?? "usuarios.cristinas.invalid";
const emailDe = (login: string) => (login.includes("@") ? login.toLowerCase() : `${login.toLowerCase()}@${dominio}`);

if (!APP_URL.startsWith("https://") && !APP_URL.startsWith("http://127.0.0.1:")) {
  console.error(`APP_URL precisa ser o endereço https do sistema (atual: "${APP_URL}").`);
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

async function linkDeSenha(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw new Error(`gerar link: ${error.message}`);
  return montarLinkDeSenha(APP_URL, data.properties.hashed_token);
}

async function gestora() {
  const login = opcao("login");
  const nome = opcao("nome");
  if (!login || !nome) throw new Error('Use: gestora --login=<usuário> --nome="<nome>"');
  const { count, error: e1 } = await admin.from("perfis").select("id", { count: "exact", head: true }).eq("papel", "gestora");
  if (e1) throw e1;
  if (count) throw new Error("Já existe gestora neste banco: as próximas pessoas entram pela tela (Configurações → Convidar).");
  const { data, error } = await admin.auth.admin.createUser({ email: emailDe(login), email_confirm: true, user_metadata: { nome } });
  if (error) throw new Error(`criar login: ${error.message}`);
  const { error: e2 } = await admin.from("perfis").insert({ id: data.user.id, nome, papel: "gestora", funcionaria_id: null, ativo: true });
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id); // sem perfil o login não serve para nada
    throw new Error(`criar perfil: ${e2.message}`);
  }
  console.log(`Gestora "${nome}" criada (usuário: ${login}). Link para ela criar a senha (vale 24 h):\n${await linkDeSenha(emailDe(login))}`);
}

async function funcionarias() {
  const arquivo = resto.find((a) => !a.startsWith("--"));
  if (!arquivo) throw new Error("Use: funcionarias <arquivo.csv> (en_no,nome,nome_exibicao,login,ativa)");
  const linhas = readFileSync(arquivo, "utf-8").replace(/^﻿/, "").trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
  for (const [enNo, nome, exibicao, , ativa] of linhas) {
    if (!enNo || !nome) throw new Error(`Linha sem ID da catraca ou nome: ${[enNo, nome].join(",")}`);
    const { error } = await admin.from("funcionarias").upsert({ en_no: enNo, nome, nome_exibicao: exibicao || nome, ativa: ativa === "S" }, { onConflict: "en_no" });
    if (error) throw new Error(`${nome}: ${error.message}`);
  }
  console.log(`${linhas.length} funcionária(s) no cadastro. O acesso de cada uma: tela Equipe → Criar acesso.`);
}

async function link() {
  const login = opcao("login");
  if (!login) throw new Error("Use: link --login=<usuário>");
  // Saída de quem perdeu o celular (ou a senha) e não tem outra gestora para gerar o link pela tela.
  const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const usuario = lista.users.find((u) => u.email === emailDe(login));
  if (!usuario) throw new Error(`Usuário "${login}" não encontrado.`);
  if (await apagarFatores(admin, usuario.id)) console.log("Verificação em duas etapas desligada (ligue de novo em Minha conta).");
  console.log(await linkDeSenha(emailDe(login)));
}

const COMANDOS: Record<string, () => Promise<void>> = { gestora, funcionarias, link };
if (!comando || !COMANDOS[comando]) {
  console.error(`Comando: ${Object.keys(COMANDOS).join(" | ")}`);
  process.exit(1);
}
COMANDOS[comando]!().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
