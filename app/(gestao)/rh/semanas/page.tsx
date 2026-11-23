import type { Metadata } from "next";
import Link from "next/link";

import { rotuloSemana } from "@/components/ponto/barra-semana";
import { Cartao, EstadoVazio, Sobretitulo, TituloPagina } from "@/components/ui/cartao";
import { exigirPapel } from "@/lib/auth";
import { duracao } from "@/lib/ponto";
import { criarClienteServidor } from "@/lib/supabase/server";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Semanas fechadas" };

export default async function SemanasFechadas() {
  await exigirPapel("contador", "gestora");
  const supabase = await criarClienteServidor();
  const [{ data: semanas }, { data: resultados }, { data: eventos }] = await Promise.all([
    supabase.from("semanas").select("segunda, fechada_em").eq("status", "fechada").order("segunda", { ascending: false }),
    supabase.from("semana_resultados").select("segunda, trabalhadas_min, fechou_corte"),
    supabase.from("semana_eventos").select("segunda, acao, motivo, em").eq("acao", "fechar").order("em"),
  ]);

  return (
    <>
      <TituloPagina contexto="Relatórios de RH" titulo="Semanas fechadas" />
      {!semanas?.length ? (
        <EstadoVazio icone={<FileText />} titulo="Nenhuma semana fechada ainda" />
      ) : (
        <Cartao className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="bg-suave">
                {["Semana", "Fechada em", "Horas da equipe", "Dias pagos", "Origem", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5">
                    <Sobretitulo>{h}</Sobretitulo>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semanas.map((s) => {
                const rs = (resultados ?? []).filter((r) => r.segunda === s.segunda);
                const ev = (eventos ?? []).filter((e) => e.segunda === s.segunda).at(-1);
                const legado = ev?.motivo?.startsWith("Importada do relatório do sistema antigo");
                return (
                  <tr key={s.segunda} className="border-t border-trilho">
                    <td className="px-4 py-3 font-bold">{rotuloSemana(s.segunda)}</td>
                    <td className="px-4 py-3">{s.fechada_em ? new Date(s.fechada_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
                    <td className="px-4 py-3">{duracao(rs.reduce((t, r) => t + r.trabalhadas_min, 0))}</td>
                    <td className="px-4 py-3">{rs.filter((r) => r.fechou_corte).length}</td>
                    <td className="px-4 py-3 text-tinta-3">{legado ? "Sistema antigo" : "Fechada no sistema"}</td>
                    <td className="px-4 py-3">
                      <span className="flex gap-3 whitespace-nowrap">
                        <Link href={`/rh/semanas/${s.segunda}`} className="font-bold text-terracota">
                          Ver espelho
                        </Link>
                        <a href={`/arquivos/planilha/${s.segunda}`} className="font-bold text-terracota">
                          .xlsx
                        </a>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Cartao>
      )}
    </>
  );
}
