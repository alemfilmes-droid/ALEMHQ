# Auditoria de baixas duplicadas

**Status:** aguardando o Anderson rodar a consulta (só leitura).

Consulta: `docs/auditoria-baixas.sql` — roda dentro de `begin read only … rollback`, não altera nada.

## Como a busca funciona
O banco já impede duas baixas no **mesmo** item (a baixa só altera itens em aberto). Então procuramos
**gêmeos**: dois lançamentos diferentes que parecem ser o mesmo pagamento ou recebimento.

- **forte**: mesmo favorecido/cliente, mesmo valor e vencimento, criados com até 30 min de diferença, e pelo
  menos um com baixa.
- **atenção**: mesmo favorecido/cliente e mesmo valor, os dois com baixa em até 1 dia de diferença (pode ser
  legítimo — conferir).

## Resultado
_(preencher com a saída da consulta)_

Nenhum registro foi alterado ou apagado.
