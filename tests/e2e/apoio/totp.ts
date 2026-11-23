/** Código de app autenticador (TOTP, RFC 6238: SHA-1, 30 s, 6 dígitos), para os testes da verificação em duas etapas. */
import { createHmac } from "node:crypto";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(texto: string): Buffer {
  let bits = "";
  for (const c of texto.replace(/=+$/, "").toUpperCase()) bits += ALFABETO.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

export function codigoTotp(segredo: string, quando = Date.now()): string {
  const passo = Buffer.alloc(8);
  passo.writeBigUInt64BE(BigInt(Math.floor(quando / 30_000)));
  const h = createHmac("sha1", base32(segredo)).update(passo).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Um código diferente do último usado (o mesmo código pode ser recusado na segunda vez): espera a janela virar. */
export async function codigoNovo(segredo: string, usado: string): Promise<string> {
  for (;;) {
    const c = codigoTotp(segredo);
    if (c !== usado) return c;
    await new Promise((r) => setTimeout(r, 1_000));
  }
}
