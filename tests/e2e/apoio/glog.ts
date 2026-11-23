/**
 * GLog sintético da semana de 28/09/2026, no formato da catraca, para os IDs 1, 4, 5, 6 e 7 (os mesmos no
 * cadastro real e no de exemplo). Três funcionárias têm uma pendência que bloqueia, cada uma de um tipo:
 *
 *   FALTOU_VOLTA (ID 1)  esqueceu a volta do almoço em 29/09
 *   DUAS_VOLTAS  (ID 4)  esqueceu a volta do almoço em 30/09 e em 01/10
 *   FALTOU_SAIDA (ID 6)  esqueceu a saída para o almoço em 02/10
 */
export const SEGUNDA_SINTETICA = "2026-09-28";
export const ID = { FALTOU_VOLTA: "000000001", DUAS_VOLTAS: "000000004", FALTOU_SAIDA: "000000006" } as const;

const DIAS = ["2026/09/28", "2026/09/29", "2026/09/30", "2026/10/01", "2026/10/02"];
const BATIDAS: Record<string, string[][]> = {
  "000000001": [["07:00", "12:12", "13:12", "17:00"], ["07:03", "12:12", "17:02"], ["07:01", "12:02", "13:28", "17:01"], ["07:02", "12:25", "13:25", "18:00"], ["07:01", "12:24", "13:28", "16:00"]],
  "000000004": [["07:02", "12:12", "13:12", "17:00"], ["07:01", "12:11", "13:14", "17:01"], ["07:04", "12:02", "17:03"], ["07:05", "12:26", "18:00"], ["07:01", "12:24", "13:28", "16:00"]],
  "000000005": [["07:00", "12:48", "13:48", "17:00"], ["07:00", "12:40", "13:40", "17:02"], ["07:00", "12:54", "13:54", "18:00"], ["07:00", "12:56", "13:56", "18:01"], ["07:00", "12:48", "13:48", "16:00"]],
  "000000006": [["07:00", "12:42", "13:40", "17:00"], ["07:00", "12:38", "13:37", "17:02"], ["07:00", "12:40", "13:38", "18:00"], ["07:00", "12:42", "13:41", "18:00"], ["07:01", "13:47", "16:00"]],
  "000000007": [["07:01", "12:45", "13:44", "17:00"], ["07:04", "12:35", "13:34", "17:02"], ["07:04", "12:33", "13:31", "18:00"], ["07:00", "12:35", "13:35", "18:00"], ["07:00", "12:42", "13:42", "16:00"]],
};

/** Arquivo pronto para `setInputFiles`. O IOMd vai qualquer (a catraca erra; o sistema só o exibe). */
export function glogSintetico() {
  const linhas = Object.entries(BATIDAS)
    .flatMap(([enNo, dias]) => dias.flatMap((horas, d) => horas.map((h) => ({ enNo, quando: `${DIAS[d]}  ${h}:00` }))))
    .sort((a, b) => a.quando.localeCompare(b.quando) || a.enNo.localeCompare(b.enNo))
    .map((b, i) => `${900000 + i}\t1\t${b.enNo}\te2e\t1\t0\t${b.quando}`);
  const texto = ["No\tMchn\tEnNo\t\tName\t\tMode\tIOMd\tDateTime\t", ...linhas, ""].join("\r\n");
  return { name: "sintetico_GLog.txt", mimeType: "text/plain", buffer: Buffer.from(texto, "utf-8") };
}
