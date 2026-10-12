/**
 * Prévia no estilo de conversa do WhatsApp (tema escuro): balão de mensagem enviada, com as quebras
 * de linha do texto. Cores do próprio WhatsApp — texto #E9EDEF sobre #005C4B tem contraste ~7:1 (AA).
 */
export function WhatsAppBubble({ text, emptyLabel = "Sem texto." }: { text: string; emptyLabel?: string }) {
  return (
    <div className="rounded-lg bg-[#0B141A] p-3" role="figure" aria-label="Prévia da mensagem no WhatsApp">
      <div className="ml-auto w-fit max-w-[92%] whitespace-pre-wrap break-words rounded-lg rounded-tr-sm bg-[#005C4B] px-3 py-2 text-[14px] leading-relaxed text-[#E9EDEF] shadow-sm">
        {text || <span className="italic text-[#E9EDEF]/80">{emptyLabel}</span>}
      </div>
    </div>
  );
}
