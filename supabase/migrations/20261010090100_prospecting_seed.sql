-- Prospecção (Módulo 1/5, 2/2): conteúdo inicial aprovado (docs/prospeccao/spec.md, seções 2–5 e 9.3).
-- Idempotente: tudo entra com "on conflict do nothing" pela chave natural — rodar de novo não
-- duplica nem sobrescreve o que o Anderson já editou nas Configurações.
-- Os textos são cópia exata da spec (cada script é um parágrafo; ver a nota no topo de spec.md).

-- ---------------------------------------------------------------------------
-- Cadências e parâmetros gerais
-- ---------------------------------------------------------------------------

insert into public.prospect_cadences (cadence_type, touch_offsets, reactivation_days, updated_by) values
  ('sazonal', '{0,2,5,10}', 30, null),
  ('relacionamento', '{0,3,8,15,25}', 60, null)
on conflict (cadence_type) do nothing;

insert into public.prospect_settings (id, meeting_duration_minutes, meeting_windows, daily_touch_target, weekly_meeting_target, updated_by)
values (true, 45, '[{"start":"09:00","end":"12:00"},{"start":"14:00","end":"17:00"}]'::jsonb, 20, 5, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Playbooks
-- ---------------------------------------------------------------------------

insert into public.prospect_playbooks
  (slug, name, audience, cadence_type, touch_zero_variant, link_base, link_appends_school_param, case_text, position, updated_by)
values
  ('campanha-matricula', 'Campanha de matrícula', 'escola', 'sazonal', 'escola_matricula_recorrente',
    'https://www.alemfilmes.com.br/institucional', true, null, 1, null),
  -- URL da página de espetáculos ainda não definida: fica vazia e a tela mostra "URL pendente".
  ('espetaculos-eventos', 'Espetáculos e eventos', 'escola', 'sazonal', 'escola_espetaculos',
    '', true, null, 2, null),
  ('conteudo-recorrente-escolas', 'Conteúdo recorrente (escolas)', 'escola', 'relacionamento', 'escola_matricula_recorrente',
    'www.alemfilmes.com.br', false, null, 3, null),
  ('filme-institucional', 'Filme institucional', 'empresa', 'relacionamento', 'empresa',
    'www.alemfilmes.com.br', false, null, 4, null),
  ('conteudo-recorrente-empresas', 'Conteúdo recorrente (empresas)', 'empresa', 'relacionamento', 'empresa',
    'www.alemfilmes.com.br', false, null, 5, null),
  ('eventos-aftermovie', 'Eventos e aftermovie', 'empresa', 'sazonal', 'empresa',
    'www.alemfilmes.com.br', false, 'a Acqua Coco no MotoGP Brasil e uma produção internacional para a Disrupty', 6, null)
on conflict (slug) do nothing;

-- Cliente da casa (spec seção 3): fechou X → sugere Y, na ordem.
insert into public.prospect_house_suggestions (closed_playbook_id, suggested_playbook_id, position)
select c.id, s.id, v.position
from (values
  ('campanha-matricula', 'espetaculos-eventos', 1),
  ('campanha-matricula', 'conteudo-recorrente-escolas', 2),
  ('espetaculos-eventos', 'conteudo-recorrente-escolas', 1),
  ('espetaculos-eventos', 'campanha-matricula', 2),
  ('filme-institucional', 'conteudo-recorrente-empresas', 1),
  ('eventos-aftermovie', 'conteudo-recorrente-empresas', 1)
) as v (closed, suggested, position)
join public.prospect_playbooks c on c.slug = v.closed
join public.prospect_playbooks s on s.slug = v.suggested
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Scripts
-- ---------------------------------------------------------------------------

create function pg_temp.touch(p_slug text, p_number int, p_body text)
returns void
language sql
as $$
  insert into public.prospect_scripts (playbook_id, kind, touch_number, body, updated_by)
  select p.id, 'toque', p_number, p_body, null from public.prospect_playbooks p where p.slug = p_slug
  on conflict on constraint prospect_scripts_unique do nothing
$$;

create function pg_temp.reactivation(p_slug text, p_body text)
returns void
language sql
as $$
  insert into public.prospect_scripts (playbook_id, kind, body, updated_by)
  select p.id, 'reativacao', p_body, null from public.prospect_playbooks p where p.slug = p_slug
  on conflict on constraint prospect_scripts_unique do nothing
$$;

-- 4.1 Toque 0 (achar o decisor)
insert into public.prospect_scripts (kind, touch_zero_variant, body, updated_by) values
  ('toque_zero', 'escola_matricula_recorrente',
    $t${saudacao}. Sou o Paulo, da além.filmes, produtora audiovisual de Natal. Preciso falar com quem cuida do marketing ou da campanha de matrícula da escola. Pode me passar o contato ou o nome da pessoa?$t$, null),
  ('toque_zero', 'escola_espetaculos',
    $t${saudacao}. Sou o Paulo, da além.filmes, produtora audiovisual de Natal. Preciso falar com quem cuida dos eventos e espetáculos da escola. Pode me passar o contato ou o nome da pessoa?$t$, null),
  ('toque_zero', 'empresa',
    $t${saudacao}. Sou o Paulo, da além.filmes, produtora audiovisual de Natal. Preciso falar com quem cuida do marketing da empresa. Pode me passar o contato ou o nome da pessoa?$t$, null)
on conflict on constraint prospect_scripts_unique do nothing;

-- 4.2 Versão sem gancho (substitui o Toque 1 quando o gancho está vazio) — "do {escola}" / "da {empresa}"
insert into public.prospect_scripts (kind, audience, body, updated_by) values
  ('sem_gancho', 'escola',
    $t${nome}, tudo bem? Sou o Paulo, da além.filmes. Pergunta rápida: hoje quem cuida dos vídeos do {escola}?$t$, null),
  ('sem_gancho', 'empresa',
    $t${nome}, tudo bem? Sou o Paulo, da além.filmes. Pergunta rápida: hoje quem cuida dos vídeos da {empresa}?$t$, null)
on conflict on constraint prospect_scripts_unique do nothing;

-- Cliente da casa (4.5 escolas, 4.7 empresas): por público, vale para qualquer playbook sugerido.
insert into public.prospect_scripts (kind, audience, body, updated_by) values
  ('cliente_da_casa', 'escola',
    $t$Olá, {nome}. Depois do {ultimo_projeto}, ficou claro o quanto o {escola} tem para mostrar ao longo do ano. Queremos propor um formato mensal para manter esse padrão o ano inteiro. Qual horário fica bom para uma reunião essa semana?$t$, null),
  ('cliente_da_casa', 'empresa',
    $t$Olá, {nome}. Depois do {ultimo_projeto}, ficou claro o quanto a {empresa} tem para mostrar. Queremos propor um formato mensal para manter esse padrão o ano inteiro. Qual horário fica bom para uma reunião essa semana?$t$, null)
on conflict on constraint prospect_scripts_unique do nothing;

-- 4.3 Playbook 1 · Escolas · Campanha de matrícula
select pg_temp.touch('campanha-matricula', 1, $t${nome}, tudo bem? Vi o perfil do {escola} e {gancho}. Sou o Paulo, da além.filmes. A gente faz o filme da campanha de matrícula de escolas aqui em Natal. A campanha de {ano_seguinte} de vocês já está em produção?$t$);
select pg_temp.touch('campanha-matricula', 2, $t${nome}, preparei uma página com o nosso trabalho para o {escola}: {link} O case do Contemporâneo mostra o padrão: um filme que as famílias compartilham e que trabalha pela escola na captação.$t$);
select pg_temp.touch('campanha-matricula', 3, $t${nome}, as campanhas de matrícula estão sendo fechadas agora. Para o filme estar no ar a tempo, a captação precisa acontecer nas próximas semanas, e nossa agenda é por data. Qual horário fica bom para uma reunião com você essa semana?$t$);
select pg_temp.touch('campanha-matricula', 4, $t${nome}, vou encerrar por aqui para não ocupar seu WhatsApp. Se a campanha do {escola} entrar em pauta, é só chamar. A página continua no ar: {link}$t$);
select pg_temp.reactivation('campanha-matricula', $t${nome}, retomando: estamos fechando a agenda de {mês} para filmes de matrícula. O {escola} já definiu o material da campanha de {ano_seguinte}?$t$);

-- 4.4 Playbook 2 · Escolas · Espetáculos e eventos
select pg_temp.touch('espetaculos-eventos', 1, $t${nome}, tudo bem? Vi o perfil do {escola} e {gancho}. Sou o Paulo, da além.filmes. Filmamos espetáculos escolares com padrão de cinema, como o Fest Show do Contemporâneo e o Sarau Literário do Sistema. Quando é o próximo espetáculo de vocês?$t$);
select pg_temp.touch('espetaculos-eventos', 2, $t${nome}, preparei uma página para o {escola} com o filme do Fest Show: {link} É o padrão que entregamos: o aftermovie que as famílias compartilham e a íntegra multicâmera como registro oficial.$t$);
select pg_temp.touch('espetaculos-eventos', 3, $t${nome}, nossa agenda de cobertura é por data, e o fim de ano concentra os espetáculos. Qual horário fica bom para uma reunião com você essa semana?$t$);
select pg_temp.touch('espetaculos-eventos', 4, $t${nome}, vou encerrar por aqui para não ocupar seu WhatsApp. Quando o próximo espetáculo do {escola} entrar em pauta, é só chamar. A página continua no ar: {link}$t$);
select pg_temp.reactivation('espetaculos-eventos', $t${nome}, retomando: estamos fechando a agenda de {mês}. O {escola} tem espetáculo ou formatura previstos?$t$);

-- 4.5 Playbook 3 · Escolas · Conteúdo recorrente
select pg_temp.touch('conteudo-recorrente-escolas', 1, $t${nome}, tudo bem? Vi os posts do {escola} e {gancho}. Sou o Paulo, da além.filmes. A gente produz conteúdo mensal para escolas, com padrão de cinema. Hoje quem faz os vídeos de vocês?$t$);
select pg_temp.touch('conteudo-recorrente-escolas', 2, $t${nome}, aqui está o padrão do nosso trabalho: {link}$t$);
select pg_temp.touch('conteudo-recorrente-escolas', 3, $t${nome}, uma observação rápida: escola que mostra o cotidiano com qualidade chega na matrícula com a confiança das famílias já construída. A campanha começa meio ganha. É isso que o conteúdo mensal faz.$t$);
select pg_temp.touch('conteudo-recorrente-escolas', 4, $t${nome}, qual horário fica bom para uma reunião com você essa semana?$t$);
select pg_temp.touch('conteudo-recorrente-escolas', 5, $t${nome}, vou encerrar por aqui. Quando o {escola} quiser planejar a comunicação do próximo ano, é só chamar.$t$);

-- 4.6 Playbook 4 · Empresas · Filme institucional
select pg_temp.touch('filme-institucional', 1, $t${nome}, tudo bem? Vi o perfil da {empresa} e {gancho}. Sou o Paulo, da além.filmes. A gente faz filme institucional com direção de cinema aqui em Natal. Vocês já têm um filme que apresente a empresa hoje?$t$);
select pg_temp.touch('filme-institucional', 2, $t${nome}, aqui está o padrão do nosso trabalho: {link}$t$);
select pg_temp.touch('filme-institucional', 3, $t${nome}, uma observação: o institucional é a primeira impressão da empresa no site, na proposta e na reunião. Quando o filme é fraco, a empresa parece menor do que é.$t$);
select pg_temp.touch('filme-institucional', 4, $t${nome}, qual horário fica bom para uma reunião com você essa semana?$t$);
select pg_temp.touch('filme-institucional', 5, $t${nome}, vou encerrar por aqui. Quando a {empresa} for renovar a apresentação institucional, é só chamar.$t$);

-- 4.7 Playbook 5 · Empresas · Conteúdo recorrente
select pg_temp.touch('conteudo-recorrente-empresas', 1, $t${nome}, tudo bem? Vi os últimos posts da {empresa} e {gancho}. Sou o Paulo, da além.filmes. A gente assume a produção de vídeo mensal de empresas, com padrão de cinema. Hoje quem produz os vídeos de vocês?$t$);
select pg_temp.touch('conteudo-recorrente-empresas', 2, $t${nome}, aqui está o padrão do nosso trabalho: {link}$t$);
select pg_temp.touch('conteudo-recorrente-empresas', 3, $t${nome}, marca forte nas redes vem de constância. Manter padrão todo mês é o difícil, e é exatamente essa parte que nós assumimos.$t$);
select pg_temp.touch('conteudo-recorrente-empresas', 4, $t${nome}, qual horário fica bom para uma reunião com você essa semana?$t$);
select pg_temp.touch('conteudo-recorrente-empresas', 5, $t${nome}, vou encerrar por aqui. Quando a {empresa} quiser planejar o conteúdo do próximo trimestre, é só chamar.$t$);

-- 4.8 Playbook 6 · Empresas · Eventos e aftermovie
select pg_temp.touch('eventos-aftermovie', 1, $t${nome}, tudo bem? Vi que a {empresa} {gancho}. Sou o Paulo, da além.filmes. Filmamos eventos como {case}. Vocês já têm alguém para o vídeo do evento?$t$);
select pg_temp.touch('eventos-aftermovie', 2, $t${nome}, aqui está o padrão: {link}. Um bom aftermovie continua trabalhando pela marca muito depois do evento.$t$);
select pg_temp.touch('eventos-aftermovie', 3, $t${nome}, nossa agenda de cobertura é por data. Qual horário fica bom para uma reunião com você essa semana?$t$);
select pg_temp.touch('eventos-aftermovie', 4, $t${nome}, vou encerrar por aqui. Quando o próximo evento da {empresa} entrar em pauta, é só chamar.$t$);

-- 4.9 Reativação ainda não escrita: fica vazia (o lead reativado usa o Toque 1 do playbook).
select pg_temp.reactivation('conteudo-recorrente-escolas', '');
select pg_temp.reactivation('filme-institucional', '');
select pg_temp.reactivation('conteudo-recorrente-empresas', '');
select pg_temp.reactivation('eventos-aftermovie', '');

-- ---------------------------------------------------------------------------
-- 5. Objeções e respostas rápidas
-- ---------------------------------------------------------------------------

insert into public.prospect_objections (shortcut, label, response_body, hq_action, position, updated_by) values
  ('/ja-temos', 'Já temos quem filme',
    $t$Ótimo, sinal de que vídeo já é prioridade para vocês. Nosso diferencial está antes da câmera: estratégia e direção criativa. Cada vídeo nasce com objetivo claro, roteiro pensado e resultado para a marca. Uma conversa de 15 minutos mostra isso na prática. Qual horário fica bom essa semana?$t$,
    'registrar', 1, null),
  ('/preco', 'Quanto custa?',
    $t$Cada projeto tem escopo próprio, por isso a proposta sai depois de uma conversa rápida. Você paga pelo que precisa, sem pacote inflado. Qual horário fica bom essa semana?$t$,
    'registrar', 2, null),
  ('/preco-espetaculo', 'Quanto custa? (espetáculos)',
    $t$Os pacotes estão no final da página que te mandei. Na reunião a gente ajusta ao tamanho do espetáculo de vocês. Qual horário fica bom essa semana?$t$,
    'registrar', 3, null),
  ('/sem-verba', 'Sem verba agora',
    $t$Entendo. Quando vocês fecham o orçamento de comunicação? Te procuro nessa data para entrarmos no planejamento.$t$,
    'pedir_data_reativacao', 4, null),
  ('/nao-sou-eu', 'Fala com outra pessoa',
    $t$Perfeito. Pode me passar o contato de quem cuida disso? Digo que falei com você.$t$,
    'novo_decisor', 5, null),
  ('/depois', 'Me chama depois',
    $t$Combinado. Qual data fica melhor para eu te chamar?$t$,
    'pedir_data_reativacao', 6, null),
  ('/material', 'Manda material por aqui',
    $t$Mando sim: www.alemfilmes.com.br. Para a proposta, uma conversa de 15 minutos com o Anderson, nosso diretor, resolve. Qual horário fica bom?$t$,
    'registrar', 7, null),
  ('/interferencia', 'A equipe atrapalha o evento?',
    $t$Não. As posições de câmera são definidas com a coordenação antes do evento, no mapa de palco. A plateia não perde a visão e o espetáculo segue normal.$t$,
    'registrar', 8, null),
  ('/imagem', 'E o uso de imagem dos alunos?',
    $t$O material segue as autorizações de imagem que a escola já coleta das famílias e é entregue para uso institucional da escola.$t$,
    'registrar', 9, null)
on conflict (shortcut) do nothing;

-- ---------------------------------------------------------------------------
-- Feriados. Fixos: recorrentes (ano de referência 2000). Móveis: calculados pela Páscoa, 2026–2035.
-- Carnaval e Corpus Christi são ponto facultativo nacional, mas a Além não prospecta nesses dias.
-- Locais (Natal/RN) entram "a confirmar".
-- ---------------------------------------------------------------------------

insert into public.prospect_holidays (holiday_date, name, scope, recurring, needs_confirmation, created_by) values
  ('2000-01-01', 'Confraternização Universal', 'nacional', true, false, null),
  ('2000-04-21', 'Tiradentes', 'nacional', true, false, null),
  ('2000-05-01', 'Dia do Trabalho', 'nacional', true, false, null),
  ('2000-09-07', 'Independência do Brasil', 'nacional', true, false, null),
  ('2000-10-12', 'Nossa Senhora Aparecida', 'nacional', true, false, null),
  ('2000-11-02', 'Finados', 'nacional', true, false, null),
  ('2000-11-15', 'Proclamação da República', 'nacional', true, false, null),
  ('2000-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional', true, false, null),
  ('2000-12-25', 'Natal', 'nacional', true, false, null),
  ('2000-01-06', 'Santos Reis', 'natal', true, true, null),
  ('2000-10-03', 'Mártires de Cunhaú e Uruaçu', 'rn', true, true, null),
  ('2000-11-21', 'Nossa Senhora da Apresentação', 'natal', true, true, null)
on conflict on constraint prospect_holidays_unique do nothing;

-- Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano).
create function pg_temp.easter(p_year int)
returns date
language plpgsql
immutable
as $$
declare
  a int := p_year % 19;
  b int := p_year / 100;
  c int := p_year % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
  v_month int := (h + l - 7 * m + 114) / 31;
  v_day int := ((h + l - 7 * m + 114) % 31) + 1;
begin
  return make_date(p_year, v_month, v_day);
end;
$$;

insert into public.prospect_holidays (holiday_date, name, scope, recurring, needs_confirmation, created_by)
select pg_temp.easter(y) + m.offset_days, m.name, 'nacional', false, false, null
from generate_series(2026, 2035) as y
cross join (values
  (-48, 'Carnaval (segunda-feira)'),
  (-47, 'Carnaval (terça-feira)'),
  (-2, 'Sexta-feira Santa'),
  (60, 'Corpus Christi')
) as m (offset_days, name)
on conflict on constraint prospect_holidays_unique do nothing;
