# Auditoria de baixas duplicadas

**Status:** concluída em 12/10/2026 (consulta rodada pelo Anderson na produção, só leitura).

Consulta: `docs/auditoria-baixas.sql` — roda dentro de `begin read only … rollback`, não altera nada.

## Como a busca funciona
O banco já impede duas baixas no **mesmo** item (a baixa só altera itens em aberto). Então procuramos
**gêmeos**: dois lançamentos diferentes que parecem ser o mesmo pagamento ou recebimento.

- **forte**: mesmo favorecido/cliente, mesmo valor e vencimento, criados com até 30 min de diferença, e pelo
  menos um com baixa.
- **atenção**: mesmo favorecido/cliente e mesmo valor, os dois com baixa em até 1 dia de diferença (pode ser
  legítimo — conferir).

## Resultado
- Conferidos: **18 pagamentos com baixa** e **4 recebimentos com baixa**.
- Gêmeos **fortes**: **nenhum**.
- Gêmeos de **atenção**: **nenhum**.

Conclusão: não há baixa duplicada na produção. As repetições relatadas pela Anna eram tentativas que
falharam sem aviso (nada foi gravado nelas), e não baixas em dobro — o que bate com a causa do Bloco 1.

Nenhum registro foi alterado ou apagado.
