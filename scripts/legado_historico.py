"""Extrai o histórico dos relatórios semanais do sistema antigo (Pontos/data/output/*.xlsx) para JSON.

Uso: python scripts/legado_historico.py <pasta data/output do Pontos>  > dados/historico-legado.json
Só lê. Layout da aba "Geral" (ver Pontos/.claude/skills/xlsx-layout):
  A-H: Data, Funcionario, Entrada, Saída almoço, Volta almoço, Saída, Horas Trabalhadas, Horas Extras
  J-P: Funcionario, K saldo anterior, L extras da semana, M acumulado, N próxima semana, O hora de corte, P status
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook

pasta = Path(sys.argv[1])
NOME = re.compile(r"^(\d{8}) - \d{2}_\d{2}-\d{2}_\d{2}\.xlsx$")


def txt(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


semanas = []
for arq in sorted(pasta.glob("*.xlsx")):
    m = NOME.match(arq.name)
    if not m:
        continue
    seg = m.group(1)
    ws = load_workbook(arq, read_only=False, data_only=True)["Geral"]
    dias, resumo = [], []
    for row in ws.iter_rows(min_row=2, values_only=True):
        a = [txt(c) for c in row[:16]] + [None] * 16
        if a[0] and a[1]:
            dias.append({
                "data": a[0].replace("/", "-"),
                "funcionario": a[1],
                "entrada": a[2], "saida_almoco": a[3], "volta_almoco": a[4], "saida": a[5],
                "trab": a[6], "extra": a[7],
            })
        if a[9]:
            resumo.append({"funcionario": a[9], "k": a[10], "l": a[11], "m": a[12], "n": a[13], "o": a[14], "p": a[15]})
    semanas.append({
        "segunda": f"{seg[:4]}-{seg[4:6]}-{seg[6:]}",
        "arquivo": arq.name,
        "gerado_em": datetime.fromtimestamp(arq.stat().st_mtime).isoformat(timespec="seconds"),
        "dias": dias,
        "resumo": resumo,
    })

print(json.dumps(semanas, ensure_ascii=False))
