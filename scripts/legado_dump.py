"""Roda a conta do script legado (Pontos/src/pontos/calculos.py) sobre um GLog e imprime JSON.

Uso: python scripts/legado_dump.py <pasta do projeto Pontos> <arquivo GLog> [--sem-cabecalho]
Saída: [{"en_no", "data", "trab", "extra"}] para cada dia útil × ID presente no arquivo.
Não grava nada; só lê.
"""

import json
import sys
import types
from datetime import datetime
from pathlib import Path

pontos_dir, glog = Path(sys.argv[1]), Path(sys.argv[2])
sem_cabecalho = "--sem-cabecalho" in sys.argv

# O config.py do legado importa python-dotenv só para ler o .env; a conta não precisa dele.
if "dotenv" not in sys.modules:
    try:
        import dotenv  # noqa: F401
    except ImportError:
        sys.modules["dotenv"] = types.SimpleNamespace(load_dotenv=lambda *a, **k: None)

sys.path.insert(0, str(pontos_dir / "src"))
from pontos.cadastro import Funcionario  # noqa: E402
from pontos.calculos import agrupar_por_dia_func, calcular_dia, to_min  # noqa: E402
from pontos.config import Config  # noqa: E402
from pontos.parser import Batida, _parse_datetime  # noqa: E402
from pontos.semanas import detectar_semanas  # noqa: E402

batidas = []
with open(glog, encoding="utf-8-sig") as f:
    for i, raw in enumerate(f, start=1):
        if i == 1 and not sem_cabecalho:
            continue
        p = raw.rstrip("\r\n").split("\t")
        if len(p) < 7:
            continue
        batidas.append(Batida(en_no=p[2].strip().zfill(9), iomd=int(p[5]), dt=_parse_datetime(p[6])))

cfg = Config(input_dir=Path("."), output_dir=Path("."), funcionarios_csv=Path("."), saldos_csv=Path("."))
bucket = agrupar_por_dia_func(batidas)
saida = []
for semana in detectar_semanas(batidas):
    for dia in semana.dias_uteis:
        for en_no in sorted({b.en_no for b in batidas}):
            func = Funcionario(id=en_no, nome_relogio="", nome_exibicao=en_no, ativo=True)
            l = calcular_dia(dia, func, bucket.get((dia, en_no), []), cfg)
            saida.append({
                "en_no": en_no,
                "data": dia.isoformat(),
                "trab": None if l.horas_trabalhadas == "Falta" else to_min(l.horas_trabalhadas),
                "extra": to_min(l.horas_extras),
            })
print(json.dumps(saida))
