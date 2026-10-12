# Cópia de segurança do banco e como restaurar

Feita antes de publicar as melhorias de outubro/2026 (Blocos 1 a 8C). Guarde o arquivo fora do projeto: ele tem
dados reais de clientes e da equipe e **nunca** deve ir para o GitHub.

## O que a cópia guarda

- **public**: tudo do HQ (clientes, projetos, pautas, CRM, financeiro, metas, agenda…).
- **auth**: as contas de acesso da equipe.
- **storage**: o registro dos arquivos enviados (logos, notas fiscais, comprovantes). Os arquivos em si ficam no
  Supabase Storage e não são mexidos por nenhuma migração desta publicação.

## Antes de tudo: quando restaurar?

Quase nunca. As migrações desta publicação **só adicionam** colunas, tabelas e funções; nenhum dado existente é
apagado ou renomeado. Se algo der errado depois de publicar, o caminho normal é **voltar o código** (o HQ antigo
funciona com o banco novo) — ver "Plano de volta" no fim do Bloco 9 em `melhorias-2026-10.md`.

Restaurar a cópia só faz sentido se dados forem perdidos ou estragados. E restaurar **apaga o que foi lançado depois
da cópia** — por isso, só fazer junto com o Claude, conferindo antes o que seria perdido.

## Como restaurar (só em último caso)

1. Avise a equipe para não usar o HQ durante a restauração.
2. No Supabase, pegue o endereço de conexão: botão **Connect** → **Session pooler** (o mesmo usado para fazer a cópia).
3. No Terminal, troque `ARQUIVO` pelo caminho da cópia e rode (ele pede a senha do banco; digite você mesmo):

   ```
   /Applications/Postgres.app/Contents/Versions/latest/bin/pg_restore --clean --if-exists --no-owner --no-privileges \
     --schema=public --single-transaction \
     -d "postgresql://postgres.jfnvknyxvybovgvtgtws@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" ARQUIVO
   ```

   `--single-transaction`: ou volta tudo, ou nada muda (se der erro no meio, o banco fica como estava).
4. Depois, rode `npx supabase migration list --linked` e peça ao Claude para conferir se o histórico de migrações
   bate com o banco restaurado.

As contas de acesso (**auth**) quase nunca precisam voltar; se precisar, é o mesmo comando com `--schema=auth`,
feito junto com o Claude.
