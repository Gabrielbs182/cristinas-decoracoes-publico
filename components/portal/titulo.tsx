/** Título de página do portal (celular). */
export function TituloPortal({ contexto, titulo }: { contexto?: string; titulo: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      {contexto ? <span className="text-xs font-semibold text-tinta-3">{contexto}</span> : null}
      <h1 className="font-display text-[23px] font-medium">{titulo}</h1>
    </div>
  );
}
