/**
 * O que o motor novo faz além do legado: validar. Os casos vêm dos arquivos reais da catraca
 * (fev e set/2026), com os horários preservados e sem nomes.
 */
import { describe, expect, it } from "vitest";

import { avaliarSemana, hhmm, REGRAS_PADRAO } from "@/lib/ponto";

import { batidas, codigos, dia, lanc, QUINTA, SABADO, seg, SEGUNDA, SEXTA } from "./ajuda";

describe("classificação pelo horário", () => {
  it("caso real 02/02: 07:01, 12:19, 17:00 → falta a volta do almoço (o legado contava só a manhã)", () => {
    const r = dia(SEGUNDA, ["07:01", "12:19", "17:00"], { iomd: [0, 1, 3] });
    expect(r.batidas.map((b) => b.tipo)).toEqual(["E", "A", "S"]);
    expect(r.situacao).toBe("pendencia");
    const p = r.pendencias[0]!;
    expect(p.codigo).toBe("FALTA_VOLTA_ALMOCO");
    expect(p.severidade).toBe("bloqueia");
    expect(p.sugestao.texto).toBe("Aplicar o almoço padrão de 1h00: volta às 13:19");
    expect(p.sugestao.acoes).toEqual([{ tipo: "adicionar_batida", horaSeg: seg("13:19"), tipoBatida: "V" }]);
    // A conta provisória continua a do legado (só a manhã), mas o dia não entra no banco.
    expect(hhmm(r.trabalhadasMin!)).toBe("05:18");
    expect(r.contaNoBanco).toBe(false);
  });

  it("aceitar a sugestão fecha o dia: volta às 13:19 vira batida ajustada", () => {
    const sugerida = lanc({ tipo: "adicionar_batida", horaSeg: seg("13:19"), tipoBatida: "V", motivo: "Almoço padrão" });
    const r = dia(SEGUNDA, ["07:01", "12:19", "17:00"], { iomd: [0, 1, 3], lancamentos: [sugerida] });
    expect(r.pendencias).toEqual([]);
    expect(r.situacao).toBe("ajustado");
    expect(hhmm(r.trabalhadasMin!)).toBe("08:59");
    expect(r.batidas.find((b) => b.origem === "manual")?.tipo).toBe("V");
    expect(r.contaNoBanco).toBe(true);
  });

  it("código de tipo errado da catraca é corrigido em silêncio (caso de set/2026)", () => {
    // A saída para o almoço veio como "2" (volta), o que aconteceu em 17 de 25 dias.
    const r = dia("2026-09-21", ["07:00", "12:48", "13:48", "17:00"], { iomd: [0, 2, 2, 3] });
    expect(r.pendencias).toEqual([]);
    expect(r.situacao).toBe("ok");
    expect(r.batidas[1]).toMatchObject({ tipo: "A", tipoCatraca: "V", tipoCorrigido: true });
  });

  it("sexta com saída marcada como volta (fev/2026) não vira pendência", () => {
    const r = dia(SEXTA, ["07:02", "12:19", "13:20", "16:00"], { iomd: [0, 1, 2, 2] });
    expect(r.pendencias).toEqual([]);
    expect(hhmm(r.trabalhadasMin!)).toBe("07:57");
  });

  it("três batidas com a do meio perto da volta: falta a saída para o almoço", () => {
    const r = dia(QUINTA, ["07:00", "13:15", "17:00"]);
    expect(codigos(r)).toEqual(["FALTA_SAIDA_ALMOCO"]);
    expect(r.pendencias[0]!.sugestao.acoes).toEqual([{ tipo: "adicionar_batida", horaSeg: seg("12:15"), tipoBatida: "A" }]);
  });

  it("três batidas terminando cedo: falta a saída, sugere o fim da jornada", () => {
    const r = dia(QUINTA, ["06:58", "12:16", "13:14"]);
    expect(codigos(r)).toEqual(["FALTA_SAIDA"]);
    expect(r.pendencias[0]!.sugestao.texto).toBe("Registrar a saída às 17:00 (fim da jornada prevista)");
  });

  it("na sexta, o fim da jornada prevista é 16:00", () => {
    const r = dia(SEXTA, ["07:00", "12:15", "13:15"]);
    expect(r.pendencias[0]!.sugestao.acoes).toEqual([{ tipo: "adicionar_batida", horaSeg: seg("16:00"), tipoBatida: "S" }]);
  });

  it("entrada e saída sem almoço num dia longo: bloqueia e sugere o almoço padrão", () => {
    const r = dia(QUINTA, ["07:00", "17:00"]);
    expect(codigos(r)).toEqual(["FALTA_ALMOCO"]);
    expect(r.pendencias[0]!.sugestao.acoes).toHaveLength(2);
  });

  it("meio período curto (até 6h) sem almoço não bloqueia", () => {
    const r = dia(QUINTA, ["07:00", "11:00"]);
    expect(r.pendencias.map((p) => p.severidade)).not.toContain("bloqueia");
    expect(codigos(r)).toContain("SAIDA_ANTECIPADA");
  });

  it("saiu no almoço e não voltou: sugere considerar meio período", () => {
    const r = dia(QUINTA, ["07:00", "12:15"]);
    expect(codigos(r)).toEqual(["SAIU_NO_ALMOCO"]);
    const acao = r.pendencias[0]!.sugestao.acoes[0]!;
    expect(acao).toMatchObject({ tipo: "trocar_tipo", tipoBatida: "S" });
  });

  it("uma batida só: bloqueia sem correção de um clique", () => {
    const r = dia(QUINTA, ["07:00"]);
    expect(codigos(r)).toEqual(["BATIDA_UNICA"]);
    expect(r.pendencias[0]!.sugestao.acoes).toEqual([]);
  });

  it("mais de 4 batidas: bloqueia e sugere desconsiderar as excedentes", () => {
    const r = dia(QUINTA, ["07:00", "12:00", "13:00", "17:00", "17:40"]);
    expect(codigos(r)).toEqual(["MAIS_DE_4_BATIDAS"]);
    expect(r.batidas[4]).toMatchObject({ tipo: null, excedente: true });
  });
});

describe("avisos (não bloqueiam o fechamento)", () => {
  it("almoço de 58 min (rotina nos dados reais) não avisa", () => {
    expect(codigos(dia(QUINTA, ["07:00", "12:42", "13:40", "17:00"]))).toEqual([]);
  });

  it("almoço curto avisa, mas a conta segue a regra (sem crédito)", () => {
    const r = dia(QUINTA, ["07:00", "12:20", "13:00", "17:00"]);
    expect(codigos(r)).toEqual(["ALMOCO_CURTO"]);
    expect(r.situacao).toBe("aviso");
    expect(hhmm(r.trabalhadasMin!)).toBe("09:00");
    expect(r.contaNoBanco).toBe(true);
  });

  it("atraso além da tolerância", () => {
    expect(codigos(dia(QUINTA, ["07:38", "12:15", "13:15", "17:00"]))).toContain("ATRASO");
    expect(codigos(dia(QUINTA, ["07:10", "12:15", "13:15", "17:00"]))).not.toContain("ATRASO");
  });

  it("mais de 2h extras no dia", () => {
    const r = dia(QUINTA, ["06:58", "12:15", "13:15", "19:20"]);
    expect(codigos(r)).toEqual(["EXTRA_ACIMA_2H"]);
  });

  it("batidas a menos de 5 min são unificadas e avisadas", () => {
    const r = dia(QUINTA, ["07:02", "07:04", "12:15", "13:15", "17:05"]);
    expect(codigos(r)).toEqual(["DUPLICADAS_UNIFICADAS"]);
    expect(r.batidas[1]).toMatchObject({ tipo: null, duplicadaDe: r.batidas[0]!.ref });
    expect(hhmm(r.trabalhadasMin!)).toBe("09:03");
  });

  it("tipo escolhido pela gestora impede a unificação automática (caso real de 06/03)", () => {
    // 07:03, 12:15, 12:16, 13:16: o motor unifica 12:15/12:16 e acusa falta da saída (5h12).
    const bat = batidas(["07:03", "12:15", "12:16", "13:16"]);
    expect(dia(QUINTA, [], { bat }).trabalhadasMin).toBe(312);
    // Na época foi apurado 12:16 como volta e 13:16 como saída (5h13). Registrar isso vale mais que a heurística.
    const comoNaEpoca = (["E", "A", "V", "S"] as const).map((t, i) => lanc({ tipo: "trocar_tipo", alvo: { batidaId: bat[i]!.id }, tipoBatida: t }));
    const r = dia(QUINTA, [], { bat, lancamentos: comoNaEpoca });
    expect(r.trabalhadasMin).toBe(313);
    expect(r.batidas.every((b) => b.duplicadaDe === null)).toBe(true);
  });

  it("confirmar o aviso resolve enquanto as batidas não mudarem", () => {
    const antes = dia(QUINTA, ["07:00", "12:20", "13:00", "17:00"]);
    const confirma = lanc({ tipo: "resolver_pendencia", codigo: "ALMOCO_CURTO", assinatura: antes.assinatura });
    const bat = batidas(["07:00", "12:20", "13:00", "17:00"]);
    const depois = dia(QUINTA, [], { bat, lancamentos: [confirma] });
    expect(depois.pendencias).toEqual([]);
    expect(depois.resolvidas.map((p) => p.codigo)).toEqual(["ALMOCO_CURTO"]);
    expect(depois.situacao).toBe("ok");

    // Mexeu no dia: a confirmação antiga deixa de valer.
    const mexe = lanc({ tipo: "alterar_horario", alvo: { batidaId: bat[2]!.id }, horaSeg: seg("12:50") });
    expect(codigos(dia(QUINTA, [], { bat, lancamentos: [confirma, mexe] }))).toEqual(["ALMOCO_CURTO"]);
  });
});

describe("diário de lançamentos", () => {
  it("alterar horário guarda o original da catraca", () => {
    const bat = batidas(["07:00", "12:00", "13:00", "17:00"]);
    const r = dia(QUINTA, [], { bat, lancamentos: [lanc({ tipo: "alterar_horario", alvo: { batidaId: bat[3]!.id }, horaSeg: seg("17:30") })] });
    expect(r.batidas[3]).toMatchObject({ hora: "17:30", horaOriginal: "17:00", ajustada: true });
    expect(r.situacao).toBe("ajustado");
    expect(hhmm(r.extraMin)).toBe("00:30");
  });

  it("desconsiderar tira a batida da conta, mas ela continua visível", () => {
    const bat = batidas(["07:00", "12:00", "13:00", "17:00", "17:40"]);
    const r = dia(QUINTA, [], { bat, lancamentos: [lanc({ tipo: "desconsiderar_batida", alvo: { batidaId: bat[4]!.id }, motivo: "Bateu duas vezes" })] });
    expect(r.pendencias).toEqual([]);
    expect(r.batidas).toHaveLength(5);
    expect(r.batidas[4]).toMatchObject({ desconsiderada: true, motivoDesconsiderada: "Bateu duas vezes", tipo: null });
  });

  it("cancelar um lançamento desfaz o efeito; cancelar o cancelamento refaz", () => {
    const add = lanc({ tipo: "adicionar_batida", horaSeg: seg("13:19"), tipoBatida: "V" });
    const cancela = lanc({ tipo: "cancelar", lancamentoAlvoId: add.id });
    const bat = batidas(["07:01", "12:19", "17:00"]);
    expect(codigos(dia(SEGUNDA, [], { bat, lancamentos: [add, cancela] }))).toEqual(["FALTA_VOLTA_ALMOCO"]);
    const recancela = lanc({ tipo: "cancelar", lancamentoAlvoId: cancela.id });
    expect(codigos(dia(SEGUNDA, [], { bat, lancamentos: [add, cancela, recancela] }))).toEqual([]);
  });

  it("trocar o tipo prevalece sobre a classificação", () => {
    const bat = batidas(["07:00", "12:15"]);
    const r = dia(QUINTA, [], { bat, lancamentos: [lanc({ tipo: "trocar_tipo", alvo: { batidaId: bat[1]!.id }, tipoBatida: "S" })] });
    expect(r.batidas[1]!.tipo).toBe("S");
    expect(codigos(r)).toEqual(["SAIDA_ANTECIPADA"]);
  });

  it("manter como está, com justificativa, resolve a pendência e marca o dia como ajustado", () => {
    const bat = batidas(["07:01", "12:19", "17:00"]);
    const antes = dia(SEGUNDA, [], { bat });
    const manter = lanc({ tipo: "resolver_pendencia", codigo: "FALTA_VOLTA_ALMOCO", assinatura: antes.assinatura, motivo: "Saiu para consulta" });
    const r = dia(SEGUNDA, [], { bat, lancamentos: [manter] });
    expect(r.pendencias).toEqual([]);
    expect(r.situacao).toBe("ajustado");
    expect(hhmm(r.trabalhadasMin!)).toBe("05:18"); // conta do legado
    expect(r.contaNoBanco).toBe(true);
  });

  it("atestado abona a carga e tira o dia das pendências", () => {
    const r = dia(QUINTA, ["07:00"], { lancamentos: [lanc({ tipo: "ocorrencia", ocorrencia: "atestado", motivo: "Consulta" })] });
    expect(r.situacao).toBe("atestado");
    expect(r.pendencias).toEqual([]);
    expect(r.trabalhadasMin).toBe(540);
    expect(r.extraMin).toBe(0);
  });
});

describe("fim de semana e feriado (regra da empresa: fora do cálculo)", () => {
  it("batida no sábado aparece com aviso e não entra no banco", () => {
    const r = dia(SABADO, ["08:00", "10:00"]);
    expect(r.foraDoCalculo).toBe(true);
    expect(codigos(r)).toEqual(["BATIDA_FIM_DE_SEMANA"]);
    expect(r.extraMin).toBe(0);
    expect(r.contaNoBanco).toBe(false);
  });

  it("feriado sem batida não é falta", () => {
    const r = dia("2026-04-21", [], { feriado: "Tiradentes" });
    expect(r.situacao).toBe("feriado");
    expect(r.cargaMin).toBe(0);
  });

  it("batida em feriado fica fora do banco", () => {
    const r = dia("2026-04-21", ["08:00", "12:00"], { feriado: "Tiradentes" });
    expect(codigos(r)).toEqual(["BATIDA_EM_FERIADO"]);
    expect(r.extraMin).toBe(0);
  });
});

describe("semana", () => {
  it("soma só os dias que contam e marca como provisória enquanto houver bloqueio", () => {
    const regras = REGRAS_PADRAO;
    const b = (data: string, horas: string[]) => batidas(horas).map((x) => ({ ...x, data }));
    const s = avaliarSemana({
      segunda: SEGUNDA,
      regras,
      feriados: {},
      batidas: [
        ...b("2026-02-02", ["07:01", "12:19", "17:00"]), // pendência: fora da soma
        ...b("2026-02-03", ["07:00", "12:00", "13:00", "18:00"]), // +1h
        ...b("2026-02-04", ["07:00", "12:00", "13:00", "17:30"]), // +0h30
        ...b("2026-02-05", ["07:00", "12:00", "13:00", "17:00"]),
        ...b("2026-02-06", ["07:00", "12:00", "13:00", "16:00"]),
        ...b("2026-02-07", ["08:00", "10:00"]), // sábado: fora
      ],
      lancamentos: [],
      saldoAnteriorMin: 6 * 60 + 53,
    });
    expect(s.dias).toHaveLength(7);
    expect(s.banco.extrasSemanaMin).toBe(90);
    expect(hhmm(s.banco.acumuladoMin)).toBe("08:23");
    expect(s.banco.fechouCorte).toBe(true);
    expect(hhmm(s.banco.proximaSemanaMin)).toBe("00:23");
    expect(s.bloqueios).toBe(1);
    expect(s.provisoria).toBe(true);
  });
});
