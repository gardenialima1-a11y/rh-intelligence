export function Footer() {
  return (
    <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border px-5 text-[11px] text-muted-foreground">
      <span>© {new Date().getFullYear()} Plataforma de People Analytics & RH BI</span>
      <span className="hidden sm:inline">Última atualização de dados: automática (diária)</span>
    </footer>
  );
}
