-- Recategorização dos lançamentos antigos (confirmada pelo Anderson em 13/10/2026; lote "2026-10-13-equipe").
--
-- Antes de aplicar, o antes e o depois de cada lançamento vão para payables_recategorization (a lista também foi
-- salva fora do banco, em ~/Documents/backup-alem-hq/2026-10-13/). Para desfazer:
--   select public.payables_recategorization_undo('2026-10-13-equipe');
--
-- • Pró-labore (categoria antiga) → Equipe e colaboradores · Pró-labore.
-- • Comissão (categoria antiga) → Equipe e colaboradores · Comissão.
-- • Pessoal/Equipe → Equipe e colaboradores · Pagamento a colaborador.
-- • Despesas com favorecido do HQ fora dessas categorias = reembolsos: marca "Reembolso de despesa"; Software
--   continua Software (Drive da empresa); Deslocamento e Outro → Outro.
-- Status de pago, valores e datas não mudam. Cada mudança entra no histórico do lançamento.

with plan as (
  select
    pa.id,
    jsonb_build_object('category', pa.category, 'team_payment_type', pa.team_payment_type, 'is_pro_labore', pa.is_pro_labore,
      'is_reimbursement', pa.is_reimbursement, 'cost_scope', pa.cost_scope) as before,
    case
      when pa.category = 'pro_labore' then
        jsonb_build_object('category', 'pessoal', 'team_payment_type', 'pro_labore', 'is_pro_labore', true, 'is_reimbursement', false,
          'cost_scope', case when pa.project_id is not null then 'projeto' else 'empresa' end)
      when pa.category = 'comissao' then
        jsonb_build_object('category', 'pessoal', 'team_payment_type', 'comissao', 'is_pro_labore', false, 'is_reimbursement', false,
          'cost_scope', case when pa.project_id is not null then 'projeto' else 'empresa' end)
      when pa.category = 'pessoal' then
        jsonb_build_object('category', 'pessoal', 'team_payment_type', 'pagamento_colaborador', 'is_pro_labore', false, 'is_reimbursement', false,
          'cost_scope', case when pa.project_id is not null then 'projeto' else 'empresa' end)
      else
        jsonb_build_object('category', case when pa.category = 'software' then 'software' else 'outro' end, 'team_payment_type', null,
          'is_pro_labore', false, 'is_reimbursement', true,
          'cost_scope', case when pa.project_id is not null or pa.company_id is not null then 'projeto' else 'empresa' end)
    end as after
  from public.payables pa
  where pa.team_payment_type is null and not pa.is_pro_labore and not pa.is_reimbursement
    and (pa.category in ('pro_labore', 'comissao', 'pessoal') or pa.payee_profile_id is not null)
)
insert into public.payables_recategorization (batch, payable_id, before, after)
select '2026-10-13-equipe', id, before, after from plan;

select public.payables_apply_state(r.payable_id, r.after, 'Categorização automática: equipe e colaboradores')
from public.payables_recategorization r
where r.batch = '2026-10-13-equipe';
