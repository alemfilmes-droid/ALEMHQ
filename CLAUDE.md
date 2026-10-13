# Além HQ — instruções para o Claude

## Idioma (regra obrigatória e permanente)

- Toda mensagem para o usuário — perguntas, instruções, atualizações de progresso e resumos finais — deve ser em **português do Brasil (PT-BR)**.
- Código, mensagens de commit e nomes de arquivo continuam em **inglês**.
- O usuário não é programador: sempre que ele precisar fazer algo, explique passo a passo **o que** fazer e **onde** (Terminal do Mac, aba Code, navegador).

## Stack

- Next.js (App Router) + Supabase, publicado na Vercel (https://hq.alemfilmes.com.br).
- Testes: `npm test` (node:test via tsx, arquivos `lib/**/*.test.ts`).
- Migrações em `supabase/migrations`; o `db push` é sempre feito pelo usuário.
