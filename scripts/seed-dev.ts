/**
 * Usuários e funcionárias de DESENVOLVIMENTO no Supabase local. Idempotente.
 *
 *   npx tsx --env-file=.env.development.local scripts/seed-dev.ts
 *
 * Funcionárias vêm de dados/funcionarias.csv (cadastro real, fora do git) quando ele existe;
 * senão, de scripts/dados-exemplo/funcionarias.csv (nomes fictícios). SEED_FUNCIONARIAS_CSV troca o arquivo.
 * O CSV manda: login de funcionária que saiu do CSV é removido do banco local.
 * Senha única de dev em SEED_SENHA (padrão abaixo) — só vale no banco local, e só para usuário criado agora
 * (--redefinir-senhas aplica também a quem já existe).
 */
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const chave = process.env.SUPABASE_SECRET_KEY!;
const dominio = process.env.USUARIOS_DOMINIO_INTERNO ?? "usuarios.cristinas.invalid";
const senha = process.env.SEED_SENHA ?? "Cristinas2026";
// Só os dois Supabase locais desta máquina: o de uso (55321) e o de teste (57321). "127.0.0.1" não basta —
// numa VPS o Supabase também escuta no loopback, e o seed trocaria a senha das contas de produção.
const alvo = URL.canParse(url ?? "") ? new URL(url) : null;
if (!alvo || !["127.0.0.1", "localhost"].includes(alvo.hostname) || !["55321", "57321"].includes(alvo.port) || process.env.NODE_ENV === "production") {
  console.error(`Recusado: o seed de desenvolvimento só roda contra o Supabase local desta máquina, porta 55321 ou 57321 (URL atual: ${url}).`);
  process.exit(1);
}
// Quem já existe mantém a senha (no banco de uso, a pessoa pode ter trocado a dela); --redefinir-senhas força a de dev.
const redefinirSenhas = process.argv.includes("--redefinir-senhas");

const admin = createClient(url, chave, { auth: { persistSession: false } });

async function garantirUsuario(login: string, nome: string): Promise<string> {
  const email = login.includes("@") ? login : `${login}@${dominio}`;
  const { data: lista, error: e1 } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (e1) throw e1;
  const existente = lista.users.find((u) => u.email === email);
  if (existente) {
    if (redefinirSenhas) {
      const { error } = await admin.auth.admin.updateUserById(existente.id, { password: senha });
      if (error) throw error;
    }
    return existente.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error) throw new Error(`criar ${email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  const arquivo =
    process.env.SEED_FUNCIONARIAS_CSV ?? (existsSync("dados/funcionarias.csv") ? "dados/funcionarias.csv" : "scripts/dados-exemplo/funcionarias.csv");
  const csv = readFileSync(arquivo, "utf-8")
    .replace(/^﻿/, "")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(","));

  const loginsValidos = new Set(csv.filter(([, , , login, ativa]) => login && ativa === "S").map(([, , , login]) => `${login}@${dominio}`));
  const { data: perfisFuncionarias, error: ePf } = await admin.from("perfis").select("id").eq("papel", "funcionaria");
  if (ePf) throw ePf;
  const { data: todos, error: eU } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (eU) throw eU;
  for (const p of perfisFuncionarias) {
    const u = todos.users.find((x) => x.id === p.id);
    if (u?.email && !u.email.startsWith("[teste]") && !loginsValidos.has(u.email)) {
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) throw new Error(`remover ${u.email}: ${error.message}`);
      console.log(`removido login que não está mais no CSV: ${u.email}`);
    }
  }

  for (const [enNo, nome, exibicao, login, ativa] of csv) {
    const { data: f, error } = await admin
      .from("funcionarias")
      .upsert({ en_no: enNo, nome, nome_exibicao: exibicao, ativa: ativa === "S" }, { onConflict: "en_no" })
      .select("id")
      .single();
    if (error) throw error;
    if (login && ativa === "S") {
      const uid = await garantirUsuario(login, nome!);
      const { error: ep } = await admin
        .from("perfis")
        .upsert({ id: uid, nome: exibicao!, papel: "funcionaria", funcionaria_id: f.id, ativo: true }); // como o criar_perfil da tela
      if (ep) throw ep;
    }
  }

  for (const [login, nome, papel] of [
    ["cristina", "Cristina", "gestora"],
    ["contador", "Contabilidade (dev)", "contador"],
  ] as const) {
    const uid = await garantirUsuario(login, nome);
    const { error } = await admin.from("perfis").upsert({ id: uid, nome, papel, funcionaria_id: null, ativo: true });
    if (error) throw error;
  }

  await exemplosDeVendas();

  const funcionarias = csv.filter(([, , , login, ativa]) => login && ativa === "S").map(([, , , login]) => login);
  console.log(`Pronto (${arquivo}). Logins (senha "${senha}"): cristina (gestora), contador, ${funcionarias.join(", ")}.`);
}

/** Catálogo e clientes de EXEMPLO (valores do protótipo, nomes fictícios), para a tela não abrir vazia. Só entra o que falta. */
async function exemplosDeVendas() {
  const produtos = [
    ["tecido", "Linho Toscana", "m", 8990, 280],
    ["tecido", "Voil Seda", "m", 4250, 300],
    ["tecido", "Blackout Premium", "m", 7600, 280],
    ["tecido", "Gaze de Linho", "m", 6490, 290],
    ["persiana", "Rolô blackout", "m2", 18900, null],
    ["persiana", "Double vision", "m2", 24900, null],
    ["persiana", "Romana", "m2", 27900, null],
    ["trilho", "Trilho suíço", "m", 5800, null],
    ["trilho", "Varão 28 mm", "m", 7200, null],
    ["trilho", "Trilho motorizado", "m", 39000, null],
    ["acessorio", "Motor para cortina", "un", 145000, null],
    ["acessorio", "Abraçadeira de tecido", "un", 2500, null],
    ["servico", "Instalação", "vao", 6000, null],
    ["servico", "Retirada de cortina antiga", "vao", 8000, null],
    ["servico", "Lavagem e passadoria", "un", 12000, null],
  ] as const;
  const { data: existentes, error: e1 } = await admin.from("produtos").select("categoria, nome");
  if (e1) throw e1;
  const faltam = produtos.filter(([cat, nome]) => !existentes.some((x) => x.categoria === cat && x.nome.toLowerCase() === nome.toLowerCase()));
  if (faltam.length) {
    const { error } = await admin
      .from("produtos")
      .insert(faltam.map(([categoria, nome, unidade, preco_centavos, largura_rolo_cm]) => ({ categoria, nome, unidade, preco_centavos, largura_rolo_cm })));
    if (error) throw error;
  }

  const modelos = [
    ["Prega wave", 2.5, 2800],
    ["Prega americana", 2.5, 2400],
    ["Ilhós", 2, 1800],
  ] as const;
  const { data: mods, error: e2 } = await admin.from("modelos_confeccao").select("nome");
  if (e2) throw e2;
  const modFaltam = modelos.filter(([nome]) => !mods.some((m) => m.nome.toLowerCase() === nome.toLowerCase()));
  if (modFaltam.length) {
    const { error } = await admin.from("modelos_confeccao").insert(modFaltam.map(([nome, fator_franzimento, preco_metro_centavos]) => ({ nome, fator_franzimento, preco_metro_centavos })));
    if (error) throw error;
  }

  const clientes = [
    { nome: "Mariana Couto (exemplo)", telefone: "(19) 99134-2280", residencia_endereco: "R. Cel. Quirino, 1100, ap. 82", residencia_bairro: "Cambuí", residencia_cidade: "Campinas/SP", obra_endereco: "R. das Hortênsias, 240", obra_bairro: "Alphaville Dom Pedro", obra_cidade: "Campinas/SP" },
    { nome: "Clínica Viver Bem (exemplo)", telefone: "(19) 3251-8890", residencia_endereco: "Av. Heitor Penteado, 500", residencia_bairro: "Taquaral", residencia_cidade: "Campinas/SP" },
    { nome: "Juliana Prado (exemplo)", telefone: "(19) 99702-5561", residencia_endereco: "R. Albino J. B. de Oliveira, 77", residencia_bairro: "Barão Geraldo", residencia_cidade: "Campinas/SP" },
  ];
  const { data: clis, error: e3 } = await admin.from("clientes").select("nome");
  if (e3) throw e3;
  const cliFaltam = clientes.filter((c) => !clis.some((x) => x.nome === c.nome));
  if (cliFaltam.length) {
    // Em lote, o PostgREST manda null (não o padrão da coluna) no campo que falta em alguma linha.
    const { error } = await admin.from("clientes").insert(cliFaltam.map((c) => ({ obra_endereco: "", obra_bairro: "", obra_cidade: "", ...c })));
    if (error) throw error;
  }
  console.log(`Vendas de exemplo: +${faltam.length} produto(s), +${modFaltam.length} modelo(s), +${cliFaltam.length} cliente(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
