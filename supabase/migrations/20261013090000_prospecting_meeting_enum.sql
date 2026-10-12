-- Prospecção (Módulo 4A, 1/2): tipo de script da frase que oferece os horários de reunião.
-- Valor novo de enum fica numa migração separada (não pode ser usado na mesma transação).
alter type public.prospect_script_kind add value if not exists 'oferta_reuniao';
