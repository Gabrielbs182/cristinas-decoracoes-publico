/**
 * Limite de tentativas erradas por chave (login, IP, usuário) numa janela de tempo. Fica na memória do processo:
 * na VPS roda um processo só do Next, e reiniciar o servidor zerar a contagem não é problema. Só falha conta;
 * acertar limpa a chave.
 */
export class LimiteDeTentativas {
  private readonly falhas = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
    private readonly agora: () => number = Date.now,
  ) {}

  private recentes(chave: string): number[] {
    const limite = this.agora() - this.janelaMs;
    const lista = (this.falhas.get(chave) ?? []).filter((t) => t > limite);
    if (lista.length) this.falhas.set(chave, lista);
    else this.falhas.delete(chave);
    return lista;
  }

  /** Minutos até poder tentar de novo (0 = pode agora). */
  espera(chave: string): number {
    const lista = this.recentes(chave);
    if (lista.length < this.maximo) return 0;
    return Math.max(1, Math.ceil((lista[0]! + this.janelaMs - this.agora()) / 60_000));
  }

  falhou(chave: string) {
    // Quem tenta milhares de logins diferentes não pode crescer o mapa sem fim: de tempos em tempos, limpa o velho.
    if (this.falhas.size > 5_000) for (const c of [...this.falhas.keys()]) this.recentes(c);
    this.falhas.set(chave, [...this.recentes(chave), this.agora()]);
  }

  limpar(chave: string) {
    this.falhas.delete(chave);
  }
}

const QUINZE_MIN = 15 * 60_000;
/** Por usuário digitado: 5 erros em 15 min. Por IP: 50 (várias pessoas da loja podem sair do mesmo IP). */
export const tentativasPorLogin = new LimiteDeTentativas(5, QUINZE_MIN);
export const tentativasPorIp = new LimiteDeTentativas(50, QUINZE_MIN);

export const mensagemDeEspera = (minutos: number) =>
  `Muitas tentativas erradas. Espere ${minutos} minuto${minutos > 1 ? "s" : ""} e tente de novo.`;

/**
 * IP de quem pediu. Atrás do proxy da VPS (Caddy), o X-Forwarded-For é posto por ele; vale o último endereço
 * (o que o nosso proxy acrescentou), não o primeiro, que o próprio cliente pode inventar.
 */
export function ipDe(cabecalhos: Headers): string {
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return encaminhado?.at(-1) ?? cabecalhos.get("x-real-ip") ?? "desconhecido";
}
