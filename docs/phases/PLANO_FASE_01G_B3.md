# Fase 1G-B3 — plano de catálogo visual e assets locais

Base de análise em 306604fb507c7e32daba8a9c46d8e2c468b00c32. Planejamento para aprovação. A implementação funcional aguarda autorização.

## Diagnóstico

O schema v3 usa união fechada de Text, Button, Input e Container e reserva resources como coleção vazia. O Inspector aplica comandos do Designer, incluindo seleção múltipla e lotes em cópia. O renderizador declarativo é compartilhado com o iframe via fonte gerada. O Preview usa origem opaca, MessagePort e CSP que hoje bloqueia imagens. O Rust consome JSON Schema gerado e aplica validações de identidade, referências e caminhos. As rotinas atuais operam sobre arquivos de workspace e exigem revisão antes de autorizar um diretório adicional. A IR v1 tipa a origem como schemaVersion 3 e limita a semântica a eventos, bindings e propriedades conhecidas. [Formato v3](../FORMATO_PROJETO_V3.md), [Designer](../../apps/studio/src/Designer.tsx), [lotes](../../packages/designer-core/index.ts), [renderizador](../../packages/preview-runtime/visual-renderer.ts), [Preview](../../packages/preview-runtime/document.ts), [persistência](../../packages/native-persistence/src/paths.rs), [validação Rust](../../packages/native-persistence/src/model.rs) e [IR](../BLUEPRINT_IR.md).

## Arquitetura recomendada

Adotar Panel como preset de Container. Adicionar Image e Icon declarativos com eventos vazios, e manter tokens tipados como incremento posterior. Checkbox, Select e lista estática exigem contratos próprios de estado, acessibilidade, opções e eventos. Permanecem candidatas futuras. [Contrato de componentes e assets](../contracts/ASSETS_VISUAIS_01G_B3.md)

A biblioteca agrupa mídia e layout. Clique e gesto usam o mesmo comando de inserção. Panel aceita hierarquia de Container, Image e Icon são folhas. Inspector separa fonte, acessibilidade, ajuste e aparência. Seleção múltipla oferece propriedades realmente comuns, indica valores mistos e publica uma transação por aplicação. Duplicar Image preserva assetId e gera ID novo de componente. O mesmo renderizador recebe uma resolução raster limitada nas duas superfícies, com placeholder comum e dimensões auto, fill ou pixels nas viewports existentes. Reabertura resolve por ID e integridade, sem persistir URLs temporárias ou estado runtime.

## Schema e migração

Propor v4 para o catálogo persistente e resources tipado. Congelar o JSON Schema v3, validar cada versão de entrada antes de transformar e encadear v0→v1→v2→v3→v4 em cópia. O passo v3→v4 mantém IDs, grafo, bindings, eventos, estilos e hierarquia, com recursos vazios e defaults explícitos apenas para novas propriedades. Abrir preserva o original até salvamento explícito. Recusar versão futura, migração incompleta e manifesto inválido sem sobrescrever original. Save As e recuperação verificam a consistência dos objetos externos com manifesto e backup. TS e Rust devem concordar sobre limites, formatos, IDs e referências, com fixtures compartilhadas válidas e inválidas.

O avanço de formato exige revisar a origem da IR, que hoje aceita literalmente v3. Definir uma projeção semântica dos campos já executáveis ou versionar o envelope com consumidores coordenados. Antes do aceite, demonstrar que Image, Icon e tokens não alteram a semântica dos 11 nodes, incluindo diagnósticos, revisão e equivalência no codegen. O schema, a IR e o runtime atuais permanecem como base até aprovação dessa decisão.

## Incrementos e gates

| Etapa | Entrega e dependências | Critérios e testes |
|---|---|---|
| 1G-B3-A | Contrato v4, JSON Schema, validadores TS/Rust, migrações e decisão sobre projeção da IR. | Fixtures v0–v4, rejeição de futuro e referências inválidas, paridade TS/Rust, reabertura, backup dos bytes antigos e equivalência dos projetos existentes. |
| 1G-B3-B | Importação e armazenamento Rust com escopo de sessão, resolução por ID, recibos, Save As e limpeza conservadora. Depende de A. | Fixtures sintéticas de traversal, reparse, links e corridas, limites e hash, falhas entre gravação e manifesto, recuperação e cópia da pasta. Medir consumo de decoder e cache. |
| 1G-B3-C | Panel como preset e Image/Icon no catálogo e renderizador compartilhado. Image depende de B. | Inserção por gesto, hierarquia, alt e modo decorativo, ajuste e dimensões, placeholder e CSP em Chromium. Testar eventos/bindings existentes e imagens hostis. |
| 1G-B3-D | Inspector, operações em lote, integração de Preview e homologação Windows. Depende de B e C. | Undo/redo, seleção mista, Save As, reabrir em novo processo, assets ausentes e viewport 375/768/desktop. Capturas Chromium e WebView2 separadas, com teclado e leitor de tela. |

**Primeiro incremento recomendado:** aprovar apenas 1G-B3-A, com fixtures de paridade e um manifesto mínimo v4 que referencia um recurso sintético. A revisão deve fechar o contrato de migração e da IR antes de habilitar importação na interface. Panel pode ser implementado como preset independente em autorização própria. Os riscos principais são corridas de caminho, decoder hostil, quota de memória, consistência entre manifesto e assets e compatibilidade do codegen.

A homologação Tauri da 1G-A, 1G-B1 e 1G-B2 e a homologação Windows integral da 1D permanecem abertas. A 1E-A segue suspensa por laboratório, a 1E-B em NO-GO e a 1F sem início. Permanecem as ressalvas de durabilidade, corrida sem CAS, RustSec, instalação limpa, WebView2, sandbox, distribuição, exportação, escala, DPI e acessibilidade. [Roadmap](../ROADMAP.md) e [plano 1G](PLANO_FASE_01G_EDITOR_VISUAL.md).
