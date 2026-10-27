# Relatório da Fase 1D-A — Contrato semântico e IR tipada

Data: 27/10/2026, America/Sao_Paulo. Estado: implementada e candidata à revisão, sem encerramento oficial. Recomendação: **GO COM RESSALVAS** no escopo desta subetapa; não constitui aprovação da 1D-B.

## Base e segurança Git

Repositório oficial: https://github.com/patrickbotarick/BTRK-Forge.git. Diretório: `C:\Projetos_VS_code\BTRK Forge`. Base main/origin/main `3a67177131f09bcef8725287fedd1b031cea0585`, limpa e conferida após fetch origin --prune antes da criação da branch `codex/phase-01d-a-semantic-ir`. A main foi preservada. Somente a branch de desenvolvimento está autorizada para publicação; sem merge, tag, release ou force push.

Commit de implementação/contrato/testes: `3e3a53f2844b0d9fc275ef154754534d68248c7f`. Este relatório, QA e roadmap são registrados em commit documental posterior; o SHA final da branch será confirmado na entrega.

## Arquitetura implementada

A transformação Blueprint → IR usa o parser/migrador e validador existentes. O resultado é uma projeção transitória, tipada, versionada e congelada profundamente, sem executor próprio ou otimização. O documento v3 continua sendo a única fonte persistente. A ordem e os IDs do documento são preservados; expressões compartilhadas permanecem referências, sem expansão ou cache.

| Arquivo | Responsabilidade |
|---|---|
| packages/blueprint-ir/types.ts | União dos 11 nodes, referências tipadas, origens, entradas, bindings, IR v1 e diagnósticos |
| packages/blueprint-ir/index.ts | lowerBlueprint, validação, distinção editável/executável e projeção imutável |
| packages/blueprint-ir/diagnostics.ts | Caminhos de schema e atribuição auxiliar de origem para falhas do validador oficial |
| packages/blueprint-ir/runtime-contract.ts | Interfaces futuras de estado, leitura/escrita, bindings, transação, visitas, valores e falhas; constantes descritivas |
| tests/semantic-ir.test.ts | 23 testes novos de transformação e expectativas semânticas independentes |
| tests/fixtures/semantic-ir/scenarios.ts | Cenários de expressão compartilhada/leitura após escrita e rollback pós-ingestão |
| tests/fixtures/semantic-ir/expected.json | Resultados escritos manualmente, incluindo sequência com ambos os ramos |
| docs/BLUEPRINT_IR.md | Contrato normativo, exemplo, responsabilidades, limites e trabalho futuro |

O [contrato completo](../BLUEPRINT_IR.md) descreve API, tipos, diagnósticos e interfaces. O [QA](../qa/VALIDACAO_FASE_01D_A.md) registra testes efetivamente executados e tentativas do ambiente.

## Semântica e compatibilidade

Os 11 tipos são event, constant, variable, set, component-value, set-text, add, greater, empty, concat e condition. Preservadas portas e identidades, eventos por componente e evento global legado. Dados são demandados, com operandos a/b ordenados; não há cache entre ações. Condição segue somente um ramo. Input string e set sincronizam bindings sem disparos recursivos.

Ingestão de input.change precede a transação das ações. Falha reverte todas as ações do evento para a base pós-ingestão, preservando trilha parcial e origem. Documento incompleto é recusado antes da ingestão. Orçamento conta cada visita, inclusive reavaliação de expressão compartilhada. A IR não executa essas regras: representa os dados necessários; os fixtures conferem o intérprete atual contra expectativas independentes.

Sem alteração do schema v3, migrações v0/v1/v2, persistência Rust, interpretador, Worker, FIFO, Design, Preview, Rete, Monaco JSON, histórico ou exportador histórico. Sem dependência nova, ampliação de permissões, eval ou execução livre. O pacote de IR não foi conectado ao fluxo funcional do Studio.

## Validação e riscos

118 testes aprovados: 68 TypeScript (45 anteriores + 23 novos), 26 Rust de persistência, 1 Rust do host, 11 E2E, 9 integração UI/driver Rust e 3 produção. Os testes novos não são contabilizados como prova de equivalência com TypeScript gerado. Typecheck/lint, Cargo check/fmt, builds web/Windows, exportador web histórico e segurança estão detalhados no QA.

IR v1 não contém estilos/hierarquia completos de renderização, source map de linhas, hash de revisão ou executor. Nenhum desses artefatos é salvo no projeto. Diagnósticos globais podem não ter node; falhas estruturais preservam a primeira falha do validador, sem prometer análise exaustiva. Consumidores precisam conferir `ir.executable`, especialmente no modo editable.

As interfaces básicas ainda não possuem implementação compartilhada. Os limites descritivos precisam continuar alinhados ao runtime existente. O gerador futuro deve evitar falhas comuns com o intérprete, usando os resultados manuais e testes diferenciais verdadeiros.

## Cinco ressalvas herdadas, abertas

1. Durabilidade física sob falha de energia não homologada.
2. Janela residual de corrida em alteração externa; não há CAS de kernel.
3. Auditoria RustSec pendente.
4. Instalação/desinstalação em máquina limpa pendente.
5. Mensagem WebView2 observada no encerramento nas fases anteriores; não foi demonstrada correção.

Nenhuma foi considerada resolvida por testes, build, npm audit ou inspeção desta fase.

## Pendências exclusivas da futura 1D-B

Mediante nova aprovação: gerar TypeScript legível e determinístico a partir da IR; implementar/extrair operações básicas compartilhadas com regressão; emitir mapa node/trechos e identidade de revisão; compilar o código gerado e comparar estado, resultados, erros e ordem com o intérprete e expectativas independentes. Limites, Unicode, orçamento e corpus reproduzível devem ser ampliados nesse teste diferencial.

A 1D-B não foi iniciada. Monaco somente leitura e diagnóstico ampliado continuam nas subetapas posteriores. Não há encerramento oficial da 1D-A nem autorização automática de avanço.
