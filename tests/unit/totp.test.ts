/** O gerador de código do app autenticador usado nos testes de navegador bate com o vetor oficial (RFC 6238). */
import { describe, expect, it } from "vitest";

import { codigoTotp } from "../e2e/apoio/totp";

describe("codigoTotp (RFC 6238, SHA-1)", () => {
  it.each([
    [59, "287082"],
    [1_111_111_109, "081804"],
    [1_234_567_890, "005924"],
  ])("t = %i s → %s", (segundos, codigo) => {
    // Segredo do apêndice B da RFC ("12345678901234567890") em base32.
    expect(codigoTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", segundos * 1000)).toBe(codigo);
  });
});
