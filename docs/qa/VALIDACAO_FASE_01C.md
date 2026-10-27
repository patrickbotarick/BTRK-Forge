# Validação da Fase 1C — Blueprint Engine

Data: 26/10/2026. Recomendação técnica: **GO COM RESSALVAS**, candidata a revisão do responsável, sem integração à main. Implementação: `467b7ff7a94d7869d58f29c866375c178990d6b8`.

## Ambiente e escopo

Clone íntegro: `E:\Projetos_VS_Code\BTRK Forge\artifacts\continuity-audit\repository`. Branch codex/phase-01c-blueprint-engine, base main/origin/main 175036e819a6b1aecccf88af8c6b9b4a34b07330. Pasta original sem Git preservada. Node 24.16.0/npm 12.0.2; Rust/Cargo 1.99.1 stable MSVC x64; Visual Studio Build Tools 2022, MSVC v143, Windows SDK 26100 e WebView2 já preparados nas fases anteriores. Não houve instalação adicional, mudança de segurança ou dependências novas.

## Resultado final automatizado

| Suíte | Comando | Aprovados | Reprovados finais |
|---|---|---:|---:|
| TypeScript/domínio/helper | npm test | 45 | 0 |
| Persistência Rust | npm run test:persistence | 26 | 0 |
| Host Tauri Rust | cargo test --manifest-path apps/studio/src-tauri/Cargo.toml --locked | 1 | 0 |
| Web E2E | npm run test:e2e | 11 | 0 |
| Integração UI + driver Rust/filesystem real | npm run test:native | 9 | 0 |
| Produção/CSP/exportador histórico | npm run test:production | 3 | 0 |
| **Total de testes** | | **95** | **0** |

Typecheck, lint, Cargo check/fmt (persistência e host), build web, exportação web histórica, desktop:build (exe/NSIS), git diff --check e git fsck aprovados. O Cargo test da biblioteca foi executado diretamente com os mesmos argumentos --lib --locked do script test:persistence. Nenhum teste final foi ignorado. Quantidade não inclui builds, scanner estático, etapas manuais ou assertions individuais.

Cobertura nova: onClick/onChange por ID; os dois ramos; leitura Input/Text; atribuição tipada e binding compartilhado; estado inicial/transitório; mensagens/eventos/estado adulterados; rollback e node de origem; referências/portas inválidas; limite de eventos; orçamento de avaliação; histórico do grafo e referências de duplicação/remoção; migrações v0/v1/v2; v3 e backup no disco; demo montada pela UI; pesquisa; erros localizáveis; cancelamento e timeout. O teste de timeout substitui o Worker por um Worker silencioso no harness do navegador, sem introduzir código executável no formato de projeto.

Regressões anteriores continuam exercitando contador, condições/comparação e estados scalar, Rete/arraste/zoom/reconexão, Designer, persistência real, Unicode, conflitos, backup/recuperação, falhas injetadas, ACL, junction/hardlink, limites e isolamento. Integração por driver Rust não é apresentada como janela Tauri.

## Homologação na janela Windows real

Executável release aberto como processo 41292. Pelo diálogo nativo, o usuário selecionou a pasta temporária `artifacts/phase01c/native-smoke/projects`. O projeto **Forge Logic Demo** foi montado pelo Designer/catálogo e formulário de conexões, usando o mesmo roteiro UI de tests/logic-flow.ts. Não houve escrita manual de JSON para construir o projeto.

Componentes: Container, título Text, Input “Seu nome”, Button “Confirmar”, resultado Text. Cinco componentes; 21 nodes e 21 conexões. Os oito nodes/conexões legados do exemplo inicial foram conservados; o Button legado foi removido visualmente. Três eventos no documento: legado sem vínculo ativo, onClick escopado ao Button e onChange escopado ao Input. O fluxo usa 13 nodes adicionais e 13 conexões adicionais.

Resultados observados antes e depois do reinício:

1. Clique com Input vazio: **Digite seu nome**.
2. onChange com Ana: resultado **Ana**, variável runtime Nome=Ana.
3. Clique: **Olá, Ana!**, trilha evento → condição → ação do ramo no.
4. Digitação sucessiva de BTRK Studio: valor completo preservado e **Olá, BTRK Studio!**.
5. Reiniciar estado: Input vazio, variável inicial vazia e Text **Resultado**; novo clique executa ramo vazio.

Salvar explícito gravou somente a definição: initial da variável permaneceu vazio; Text.props.text permaneceu Resultado. O processo 41292 foi encerrado; nova instância 39908 aberta; usuário selecionou o mesmo manifesto. O documento em disco permaneceu exatamente igual, com IDs, referências, posições, componentes, nodes e conexões. O runtime iniciou vazio, e ambos os ramos/onChange foram executados novamente.

Após ajustar somente a explicação da confirmação de remoção de componentes, o release final foi recompilado. O binário final recebeu smoke adicional em processo 48352: abertura, importação em memória do manifesto temporário já homologado e repetição dos dois ramos/onChange. Essa etapa não substitui a comprovação anterior de persistência nativa e não gravou o projeto. A janela desse smoke foi mantida aberta para conferência; sua cópia importada é transitória.

Instrumentação: CDP local por variável de ambiente apenas nos processos de teste WebView2; reconhecimento da janela nativa pelo Computer Use. CSP/capabilities de produção não foram relaxadas. Os dois seletores nativos exigiram seleção manual porque não ficaram acessíveis à automação.

## Evidências versionadas

- [Blueprint na janela release](evidencias/fase01c/blueprint-release.png).
- [Saudação após processo novo](evidencias/fase01c/preview-after-restart.png).
- [Ramo vazio após reinício](evidencias/fase01c/preview-empty.png).
- [Recibo comparativo do reinício e eventos/IDs](evidencias/fase01c/native-restart.json).
- [Manifesto temporário salvo pelo serviço nativo](evidencias/fase01c/native-demo-project.json).
- [Smoke do binário final](evidencias/fase01c/final-binary-smoke.json) e [imagem](evidencias/fase01c/final-binary-smoke.png).
- [Resultados compactos e hashes](evidencias/fase01c/verification.json).
- [npm audit completo](evidencias/fase01c/npm-audit.json).

Relatórios completos locais: artifacts/unit-results.json, e2e-results.json, native-e2e-results.json, production-results.json; artifacts/phase01c/native-smoke contém as evidências brutas e o projeto temporário. Perfis WebView2, executáveis e diretórios temporários não foram versionados.

## Problemas identificados e correções

As primeiras execuções encontraram expectativas de schema 2 que precisavam refletir a migração para 3. As fixtures v2 ficaram congeladas; não foram reescritas para encobrir incompatibilidade. Um teste novo de binding estava deixando uma ação sem entrada e foi corrigido para completar a cadeia.

A integração nativa revelou conservação indevida de runtime quando a mesma definição era fechada e reaberta na mesma janela. O ciclo de vida foi vinculado à identidade da sessão e o teste de integração confirmou o reinício. Uma alteração de layout ocultava Restaurar exemplo; o controle foi movido para o cabeçalho e a regressão passou. Ajustes de importação de teste/typecheck e feedback do editor foram concluídos antes da rodada final. Zero falhas finais.

Avisos não bloqueantes: chunks de produção grandes (Monaco e editor); aviso NO_COLOR/FORCE_COLOR no harness. Não há promessa de desempenho para grafos extensos ou matriz ampla de hardware/DPI.

## Auditorias e não executados

Scanner de padrões conhecidos de segredos e configuração de permissões: zero achados; não é auditoria exaustiva. npm audit completo e somente produção: zero vulnerabilidades reportadas nesta execução. Cargo-audit não está instalado; RustSec **não executado**. Não instalar ferramenta adicional foi uma escolha conservadora para preservar a ressalva, não um resultado aprovado de RustSec.

Não executados/homologados: falha física de energia, instalação/desinstalação em máquina limpa, eliminação da corrida externa residual, correção da mensagem WebView2 no encerramento, exportação generalizada de projetos visuais, equivalência com código TypeScript gerado, matriz completa de Windows/filesystems/DPI e acessibilidade assistiva completa. [Todas as limitações](../LIMITACOES_FASE_01C.md).

Executável final: apps/studio/src-tauri/target/release/btrk-forge.exe. NSIS: apps/studio/src-tauri/target/release/bundle/nsis/BTRK Forge_0.0.1_x64-setup.exe. Hashes em verification.json; sem assinatura comercial, tag ou release.
