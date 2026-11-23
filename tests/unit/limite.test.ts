/**
 * Limite de tentativas. Regressão (auditoria de 24/10/2026, B6): o login não tinha limite no app, e o do Auth
 * só vê o IP do servidor Next — ou seja, nenhum limite por quem tenta.
 */
import { describe, expect, it } from "vitest";

import { ipDe, LimiteDeTentativas, mensagemDeEspera } from "@/lib/limite";

const relogio = () => {
  let t = 1_000_000;
  return { agora: () => t, andar: (ms: number) => (t += ms) };
};

describe("limite de tentativas", () => {
  it("bloqueia na quinta falha e libera quando a janela passa", () => {
    const r = relogio();
    const l = new LimiteDeTentativas(5, 15 * 60_000, r.agora);
    for (let i = 0; i < 4; i++) l.falhou("ana.s");
    expect(l.espera("ana.s")).toBe(0);
    l.falhou("ana.s");
    expect(l.espera("ana.s")).toBe(15);
    r.andar(10 * 60_000);
    expect(l.espera("ana.s")).toBe(5);
    r.andar(5 * 60_000 + 1);
    expect(l.espera("ana.s")).toBe(0);
  });

  it("cada chave conta sozinha e acertar limpa", () => {
    const l = new LimiteDeTentativas(2, 60_000);
    l.falhou("a");
    l.falhou("a");
    expect(l.espera("a")).toBeGreaterThan(0);
    expect(l.espera("b")).toBe(0);
    l.limpar("a");
    expect(l.espera("a")).toBe(0);
  });

  it("muitas chaves diferentes não seguram memória velha", () => {
    const r = relogio();
    const l = new LimiteDeTentativas(5, 1_000, r.agora);
    for (let i = 0; i < 5_001; i++) l.falhou(`login${i}`);
    r.andar(2_000);
    l.falhou("novo");
    expect((l as unknown as { falhas: Map<string, number[]> }).falhas.size).toBe(1);
  });

  it("mensagem no singular e no plural", () => {
    expect(mensagemDeEspera(1)).toBe("Muitas tentativas erradas. Espere 1 minuto e tente de novo.");
    expect(mensagemDeEspera(12)).toBe("Muitas tentativas erradas. Espere 12 minutos e tente de novo.");
  });

  it("IP: o último do X-Forwarded-For (o que o nosso proxy pôs), não o que o cliente inventou", () => {
    expect(ipDe(new Headers({ "x-forwarded-for": "1.2.3.4, 200.10.10.10" }))).toBe("200.10.10.10");
    expect(ipDe(new Headers({ "x-forwarded-for": "200.10.10.10" }))).toBe("200.10.10.10");
    expect(ipDe(new Headers({ "x-real-ip": "10.0.0.2" }))).toBe("10.0.0.2");
    expect(ipDe(new Headers())).toBe("desconhecido");
  });
});
