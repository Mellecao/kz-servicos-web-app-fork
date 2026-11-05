# Aprovação Administrativa do Re-check em Nome do Cliente

**Data:** 2026-06-23  
**Status:** Aprovado

## Objetivo

Permitir que o administrador, durante a etapa `searching_drivers`, aprove em nome do cliente uma proposta de motorista que já tenha sido aprovada para exibição ao cliente.

## Comportamento

- O botão atual continua alternando entre `Aprovar para cliente` e `Aprovado ✓`.
- Quando um candidato estiver com status `accepted`, possuir `offered_price` e estiver com `admin_approved = true`, será exibido ao lado o botão `Cliente: aprovar`.
- O botão só será exibido enquanto a viagem estiver em `searching_drivers`.
- O clique solicitará confirmação antes de concluir a escolha.
- Durante o processamento, a ação ficará desabilitada para impedir cliques duplicados.

## Fluxo de Dados

Após a confirmação, a interface reutilizará `selectTripDriver`, enviando:

- ID da viagem;
- ID do candidato;
- ID do perfil do motorista;
- preço ofertado.

A função existente é responsável por:

- definir o motorista selecionado na viagem;
- gravar o preço final;
- alterar o status da viagem conforme a implementação vigente da RPC;
- marcar o candidato escolhido como aceito;
- rejeitar os demais candidatos.

Depois da chamada, candidatos e viagem serão recarregados. O fluxo seguinte será o re-check do motorista já adotado pelo sistema.

## Erros

- Se a chamada falhar, a viagem não será considerada selecionada na interface.
- O administrador verá uma mensagem de erro.
- O botão será reabilitado para nova tentativa.

## Escopo

Não serão criadas novas colunas, tabelas ou RPCs. A mudança ficará restrita à interface e ao reaproveitamento da ação de seleção já existente.

## Testes

- O botão não aparece antes de `admin_approved = true`.
- O botão aparece para candidato aceito, aprovado e com preço durante `searching_drivers`.
- A confirmação executa a seleção com os IDs e preço corretos.
- O botão impede envio duplicado enquanto a chamada está em andamento.
- Falhas exibem erro e liberam uma nova tentativa.
