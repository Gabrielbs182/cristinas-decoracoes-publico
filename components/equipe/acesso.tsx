"use client";

/** Ações de acesso ao sistema: criar login, mandar o link da senha pelo WhatsApp, bloquear. */
import { Copy, KeyRound, Lock, LockOpen, MessageCircle, UserPlus } from "lucide-react";
import { createContext, use, useState, useTransition } from "react";
import { toast } from "sonner";

import { bloquearAcesso, criarAcesso, novoLinkDeSenha, type RespostaLink } from "@/app/(gestao)/acessos/acoes";
import { useAcao } from "@/components/ponto/usar-acao";
import { Botao } from "@/components/ui/botao";
import { Campo, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/selo";
import { ROTULO_ACESSO, type SituacaoAcesso } from "@/lib/equipe";

type LinkPronto = Extract<RespostaLink, { ok: true }>;

/** Mostra o link uma vez, com a mensagem pronta para o WhatsApp. */
function DialogoLink({ link, aoFechar }: { link: LinkPronto | null; aoFechar: () => void }) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link!.texto);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não deu para copiar. Selecione o texto e copie.");
    }
  };
  return (
    <Dialogo
      aberto={!!link}
      aoMudar={(a) => !a && aoFechar()}
      titulo="Link para criar a senha"
      descricao="Mande para a pessoa pelo WhatsApp. O link vale por 24 horas e funciona uma vez só; se perder, gere outro."
      rodape={
        <>
          <Botao variante="secundario" onClick={copiar}>
            <Copy /> Copiar mensagem
          </Botao>
          <a href={link?.whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-sucesso px-4 text-sm font-bold text-white no-underline hover:bg-[#245a39]">
            <MessageCircle className="size-4" /> Enviar pelo WhatsApp
          </a>
        </>
      }
    >
      <textarea readOnly value={link?.texto ?? ""} rows={6} aria-label="Mensagem com o link" className="w-full resize-none rounded-lg border border-borda-campo bg-suave p-3 text-[13px]" onFocus={(e) => e.target.select()} />
    </Dialogo>
  );
}

const MostrarLink = createContext<((l: LinkPronto) => void) | null>(null);

/**
 * Guarda o link fora da linha da tabela: criar o acesso recarrega a página e troca o botão da linha,
 * e o link sumiria junto com ele.
 */
export function ProvedorLinks({ children }: { children: React.ReactNode }) {
  const [link, setLink] = useState<LinkPronto | null>(null);
  return (
    <MostrarLink value={setLink}>
      {children}
      <DialogoLink link={link} aoFechar={() => setLink(null)} />
    </MostrarLink>
  );
}

function useLink() {
  const mostrar = use(MostrarLink);
  if (!mostrar) throw new Error("useLink precisa do ProvedorLinks.");
  const [enviando, iniciar] = useTransition();
  const pedir = (acao: () => Promise<RespostaLink>, depois?: () => void) =>
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      mostrar(r);
      depois?.();
    });
  return { enviando, pedir };
}

const SELO = {
  ativo: { tom: "ok", icone: "check" },
  convite: { tom: "atencao", icone: "relogio" },
  bloqueado: { tom: "perigo", icone: "bloqueio" },
  sem_acesso: { tom: "neutro", icone: "circulo" },
} as const satisfies Record<SituacaoAcesso, unknown>;

export function SeloAcesso({ situacao, className }: { situacao: SituacaoAcesso; className?: string }) {
  return (
    <Selo tom={SELO[situacao].tom} icone={SELO[situacao].icone} className={className}>
      {ROTULO_ACESSO[situacao]}
    </Selo>
  );
}

/** Link novo e bloqueio de um acesso que já existe. */
export function AcoesDeAcesso({ userId, situacao, ehVoce }: { userId: string; situacao: SituacaoAcesso; ehVoce?: boolean }) {
  const { enviando, pedir } = useLink();
  const { enviando: bloqueando, executar } = useAcao();
  const [confirmar, setConfirmar] = useState(false);
  const bloqueado = situacao === "bloqueado";

  // `contents`: os botões entram no mesmo fluxo dos outros da linha (no celular não quebram em bloco separado).
  return (
    <div className="contents">
      {!bloqueado ? (
        <Botao variante="secundario" tamanho="p" disabled={enviando} onClick={() => pedir(() => novoLinkDeSenha({ userId }))}>
          <KeyRound /> {situacao === "convite" ? "Reenviar convite" : "Redefinir senha"}
        </Botao>
      ) : null}
      {!ehVoce ? (
        bloqueado ? (
          <Botao variante="secundario" tamanho="p" disabled={bloqueando} onClick={() => executar(() => bloquearAcesso({ userId, bloquear: false }))}>
            <LockOpen /> Desbloquear
          </Botao>
        ) : (
          <Botao variante="perigo" tamanho="p" disabled={bloqueando} onClick={() => setConfirmar(true)}>
            <Lock /> Bloquear
          </Botao>
        )
      ) : null}
      <Dialogo
        aberto={confirmar}
        aoMudar={setConfirmar}
        titulo="Bloquear o acesso?"
        descricao="A pessoa sai do sistema na hora e não entra mais até você desbloquear. Nada do que ela registrou é apagado."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" disabled={bloqueando} onClick={() => executar(() => bloquearAcesso({ userId, bloquear: true }), () => setConfirmar(false))}>
              Bloquear
            </Botao>
          </>
        }
      />
    </div>
  );
}

/** Funcionária sem acesso: escolher o usuário e gerar o convite. */
export function CriarAcessoFuncionaria({ funcionariaId, nome, sugestao }: { funcionariaId: string; nome: string; sugestao: string }) {
  const { enviando, pedir } = useLink();
  const [aberto, setAberto] = useState(false);
  const [login, setLogin] = useState(sugestao);

  return (
    <>
      <Botao tamanho="p" onClick={() => setAberto(true)}>
        <UserPlus /> Criar acesso
      </Botao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo={`Acesso de ${nome}`}
        descricao="Sem e-mail, ela entra com um usuário curto. Depois você manda o link para ela criar a senha."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao disabled={enviando || login.trim().length < 3} onClick={() => pedir(() => criarAcesso({ papel: "funcionaria", funcionariaId, login }), () => setAberto(false))}>
              Criar e gerar link
            </Botao>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Usuário ou e-mail</span>
          <Campo value={login} onChange={(e) => setLogin(e.target.value.toLowerCase())} autoCapitalize="none" autoFocus />
          <span className="text-xs text-tinta-3">Letras minúsculas, números e ponto (ex.: ana.s), ou o e-mail dela.</span>
        </label>
      </Dialogo>
    </>
  );
}

/** Gestora ou contador(a): nome, papel e usuário (de preferência o e-mail). */
export function ConvidarUsuario() {
  const { enviando, pedir } = useLink();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<"contador" | "gestora">("contador");
  const [login, setLogin] = useState("");

  return (
    <>
      <Botao tamanho="p" onClick={() => setAberto(true)}>
        <UserPlus /> Convidar
      </Botao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo="Convidar para o sistema"
        descricao="Funcionárias ganham acesso pela Equipe. Aqui entram a contabilidade e outras gestoras."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao
              disabled={enviando || nome.trim().length < 2 || login.trim().length < 3}
              onClick={() =>
                pedir(
                  () => criarAcesso({ papel, nome, login }),
                  () => {
                    setAberto(false);
                    setNome("");
                    setLogin("");
                  },
                )
              }
            >
              Criar e gerar link
            </Botao>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Nome</span>
          <Campo value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Perfil</span>
          <Selecao value={papel} onChange={(e) => setPapel(e.target.value as "contador" | "gestora")}>
            <option value="contador">Contador(a) · só leitura de RH e recibos</option>
            <option value="gestora">Gestora · acesso total</option>
          </Selecao>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">E-mail ou usuário</span>
          <Campo value={login} onChange={(e) => setLogin(e.target.value.toLowerCase())} autoCapitalize="none" />
        </label>
      </Dialogo>
    </>
  );
}
