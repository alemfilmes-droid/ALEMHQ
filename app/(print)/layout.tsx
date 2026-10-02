/** Documentos para imprimir/salvar em PDF (nota de orçamento, apresentação): sem o menu do sistema. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-root">{children}</div>;
}
