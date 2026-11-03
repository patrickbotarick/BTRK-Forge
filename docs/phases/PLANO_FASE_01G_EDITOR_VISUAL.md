# Fase 1G-P — plano do Visual Designer e Blueprint Editor avançado

Base de análise: main em 79fc3dbb038f80a3470b0d0d063491f4f4d475fb. Proposta para revisão. A numeração histórica e a ordem de entrega do [roadmap](../ROADMAP.md) ficam preservadas. Os incrementos de edição local podem ser avaliados independentemente da 1E-B e da 1F. A entrega de exportação continua condicionada às fases correspondentes.

## Diagnóstico e experiência desejada

| Superfície | Estado atual | Evolução proposta |
|---|---|---|
| Design | Quatro tipos, Text, Button, Input e Container. Uma tela, árvore com reordenação e mudança de pai, seleção única, drag para inserir e undo/redo. Container tem Flex em linha/coluna e wrap. Viewports de 375/768 px e fluido são simulações de largura. | Hierarquia navegável por teclado, biblioteca por categoria, edição visual de largura/altura, reordenação e inserção com alvo explícito. Layout relativo ao pai com Flex e Grid, sobreposições responsivas limitadas e fallback explícito. |
| Inspector | Controles tipados e estilos comuns. Seleção e referências por ID. | Grupos Aparência, Layout, Comportamento e Eventos. Alterações inválidas com diagnóstico local. Campos mistos em seleção múltipla, com aplicação atômica. |
| Blueprint | Rete já oferece conexão por gesto, zoom/pan/enquadramento, seleção e busca de catálogo. Portas exec/number/string/boolean, 11 tipos, variáveis escalares, click/change, binding de Input, diagnósticos e navegação. | Paleta contextual a partir de porta ou seleção, explicação de incompatibilidade, grupos de nodes e comentários, busca por nome/ID, diagnóstico acessível e navegação consistente para código e depuração. Funções tipadas entram após contrato semântico. |
| Studio | Explorer básico, área central alterna Design, Blueprint, Preview, Código e Depuração, com console inferior. Preview compartilha o renderizador e envia eventos ao Worker. Monaco mostra TypeScript gerado, com JSON em superfície separada. | Explorer à esquerda com telas, grafos e estado. Biblioteca em painel ou aba contextual. Editor central com abas, Inspector à direita e console/depuração inferiores. Preview integrado por aba e painel quando houver largura. Divisórias redimensionáveis por teclado e ponteiro, restauração de layout e foco por área. |
| Contratos | Schema v3 aceita uma tela e funções/recursos vazios. Designer, Preview e edição de eventos consultam diretamente a primeira tela. Rust também valida o manifesto e as migrações. | Identificar a tela explicitamente por ID antes de aceitar múltiplas telas. Evoluir contratos TypeScript, JSON Schema e Rust em conjunto quando o formato persistente mudar. |

O canvas deve usar o idioma português e a identidade BTRK Studio. A interação com Blueprint se inspira na criação contextual e na leitura de fluxos da Unreal Engine, com apresentação própria. O Designer edita a definição e o Preview executa seus eventos. O escopo abrange projetos do Studio, com autoedição do Forge fora do produto planejado.

Referências: [Designer](../COMPONENTES_FASE_01B.md), [formato v3](../FORMATO_PROJETO_V3.md), [Blueprint](../BLUEPRINT_ENGINE.md), [Designer UI](../../apps/studio/src/Designer.tsx), [Graph UI](../../apps/studio/src/Graph.tsx), [adaptador Rete](../../apps/studio/src/rete.ts) e [validação Rust](../../packages/native-persistence/src/model.rs).

## Arquitetura recomendada

**Documento validado → projeções de Design e Blueprint → IR tipada → TypeScript derivado.** Design e Blueprint editam o mesmo documento por comandos de domínio. Rete e React representam o documento por IDs estáveis. Cada gesto estrutural deve resultar em uma transação, com validação antes de publicar, uma entrada no undo e restauração coerente de seleção. Navegação, viewport, painéis e filtros ficam em estado de sessão ou preferências locais. Estado do Preview, histórico de depuração e mapas de código continuam transitórios.

Manter um renderizador declarativo para Design e Preview. O catálogo deve definir propriedades, filhos aceitos, eventos e representação acessível. O Inspector deriva dos contratos de propriedades. Estilos usam valores enumerados e tokens tipados com fallback; assets exigem referências locais validadas, limites e política explícita de formatos. Evoluir layout com medidas relativas ao pai, alças de dimensionamento limitadas e teclado, preservando a ordem de leitura. Posicionamento absoluto livre exige contrato futuro.

Monaco continua somente leitura para TypeScript. A coordenação conserva sessão, revisão, SHA-256 e intervalos UTF-16. Navegação deve resolver IDs apenas no artefato da revisão ativa. Alterações de semântica passam por validação e lowering, com comparação diferencial de resultados, estado, erros, ordem, trace e rollback. O Preview segue no Worker declarativo. Código editável futuro exigirá regiões isoladas, entradas e saídas tipadas, origem versionada, análise de representabilidade e política de execução aprovada. Fora desse subconjunto, a transformação visual deve recusar a alteração com diagnóstico. Edição bidirecional livre permanece fora da v1.0.

As mudanças persistentes exigem nova revisão de schema aprovada. Migrações devem preservar IDs, valores, conexões, posições, bindings e o comportamento legado de eventos. Ler v0–v3 por fixtures independentes, migrar em cópia, validar em TS e Rust e preservar o original até o salvamento explícito. Versões futuras incompatíveis devem ser recusadas com diagnóstico; evitar downgrade silencioso. A IR só muda quando a semântica executável exigir, com consumidores revisados em conjunto. Layout e metadados visuais ficam fora da semântica do gerador.

Referências: [IR](../BLUEPRINT_IR.md), [TypeScript](../CODEGEN_TYPESCRIPT.md), [Monaco](../MONACO_CODE_INTEGRATION.md), [Debugging](../RUNTIME_DEBUGGING.md) e [schema](../../packages/project-schema/index.ts).

## Incrementos propostos

### 1G-A — navegação, Inspector e paleta contextual em v3

**Objetivo e escopo.** Melhorar os quatro componentes e 11 nodes existentes. Agrupar Inspector, organizar categorias, pesquisar em português, abrir paleta a partir de porta ou por teclado, mostrar compatibilidade e diagnóstico no node, preservar zoom e foco ao navegar entre Blueprint, Código e Depuração. Primeira fatia do shell com Explorer orientado pelo documento, divisórias e preferência local, se a prova de foco comportar.

**Dependências e módulos.** Apenas Studio e contratos atuais. [Shell](../../apps/studio/src/main.tsx), [Designer](../../apps/studio/src/Designer.tsx), [Graph](../../apps/studio/src/Graph.tsx), [Rete](../../apps/studio/src/rete.ts), [estilos](../../apps/studio/src/style.css) e [edição validada](../../packages/blueprint-core/edit.ts). Reusar regras de portas. Uma ação composta de inserir e conectar só é aceita se o documento final validar.

**Contratos e migração.** Preferências com defaults e IDs por sessão. Schema v3 e IR v1, sem migração. **Testes e demonstração.** Abrir fixture v3, navegar pelo teclado, criar uma ligação válida a partir de uma porta, ver motivo de incompatibilidade, desfazer em um passo, localizar erro em Código e retornar pelo Debug. Conferir que navegação não marca o documento como alterado. **Riscos.** Atalhos do Monaco, foco entre abas, corridas de projeção Rete e seleção obsoleta após undo ou troca de projeto.

### 1G-B — layout, hierarquia e catálogo visual mínimo

**Objetivo e escopo.** Seleção múltipla, reordenar/mover em lote, dimensionamento relativo ao pai, Grid simples e breakpoints fixos. Alinhar e distribuir irmãos por regras do container. Painel como variante de Container, estilos reutilizáveis por tokens e imagens/ícones locais com formatos e limites explícitos. Avaliar checkbox, seletor e lista estática após fechar a tipagem de propriedades e eventos. Listas dinâmicas ficam para evolução posterior.

**Dependências e módulos.** 1G-A para Inspector e foco. [Designer core](../../packages/designer-core/index.ts), [componentes](../../packages/project-schema/components.ts), [renderizador](../../packages/preview-runtime/visual-renderer.ts), persistência Rust e superfícies de Design/Preview. Assets só entram após política de acesso local, identidade, limites e resolução comum de renderização.

**Contratos e migração.** Revisão de schema para tipos e propriedades novas, fallback para os estilos e layout Flex atuais. Edições em lote atômicas, inclusive se um alvo falhar. Tipos interativos novos entram apenas com semântica definida e testes diferenciais. **Testes e demonstração.** Reabrir projeto legado, montar painel com imagem/ícone, mover vários irmãos, desfazer e comparar Design e Preview a 375 e 768 px e desktop. Exercitar ciclo, reparent inválido, limites, texto alternativo e asset hostil. **Riscos.** Divergência de layout, URLs/traversal, regressão visual em legado e custo de renderização.

### 1G-C — múltiplas telas e navegação declarativa

**Objetivo e escopo.** Criar, renomear, duplicar e ordenar telas, definir inicial, navegar por ação declarativa com alvo válido e retornar pelo Preview. Separar tela selecionada no editor de tela ativa no runtime. Preservar IDs globalmente únicos e bloquear exclusão com referências até resolução explícita.

**Dependências e módulos.** Adaptar os acessos à primeira tela em Designer, [Preview](../../apps/studio/src/Preview.tsx), schema, designer-core e [runtime Blueprint](../../packages/blueprint-core/runtime.ts). Revisar [Worker](../../packages/preview-runtime/execution.worker.ts), IR, [codegen](../../packages/typescript-codegen/index.ts) e persistência. Sem dependência de broker ou exportação.

**Contratos e migração.** Preservar a tela única como inicial. Especificar estado de tela, propriedade transitória, escopo de eventos e rollback de navegação antes de versionar IR e runtime. **Testes e demonstração.** Migrar, salvar e reabrir fixture v3, criar duas telas, navegar por botão, invalidar referência com diagnóstico e confirmar rollback quando uma ação posterior falhar. Testar equivalência Preview/TypeScript e rejeição de evento de tela inativa. **Riscos.** Vínculos órfãos, duplicação de IDs, perda de estado e mistura entre seleção e execução.

### 1G-D — organização avançada e reutilização

**Objetivo e escopo.** Comentários e grupos visuais, busca/navegação em grafos maiores, layout automático determinístico e reversível. Reutilização inicial por modelos locais copiados com novos IDs. Funções reutilizáveis com portas e parâmetros tipados, sem recursão inicialmente, entram somente após contrato de escopo, efeitos e orçamento. Variáveis conservam tipos atuais, com renomeação por ID e remoção guiada por referências.

**Dependências e módulos.** Rete, Blueprint core, schema e Designer. Para funções executáveis, também IR, runtime, codegen e Debug. **Contratos e migração.** Metadados visuais separados da execução. Grupos persistidos exigem revisão de schema; projetos antigos abrem com grupos vazios. Funções só ganham contrato persistente após oráculos independentes. **Testes e demonstração.** Organizar grafo com comentários e enquadramento, desfazer layout sem alterar semântica, copiar modelo preservando referências internas com IDs novos. Se funções forem autorizadas, executar duas chamadas com dados distintos e validar trace, orçamento, erros e navegação de origens. **Riscos.** Enquadramento instável, perda de referências, revisão semântica indevida e explosão de custo de execução.

## Corte da v1.0 e riscos transversais

- **Essencial proposto.** Explorer navegável, Inspector categorizado, catálogo básico ampliado com painel e mídia local, Flex/Grid simples e viewports responsivos, duas ou mais telas com navegação declarativa, os 11 nodes compatíveis, paleta contextual, conexões tipadas, diagnósticos e navegação Designer ↔ Blueprint ↔ Código ↔ Depuração. Seleção múltipla básica e grupos/comentários entram se os testes de acessibilidade e regressão passarem. O fluxo ponta a ponta da v1.0 ainda depende de exportação e distribuição segundo o roadmap.
- **Pós-1.0 ou gate próprio.** Alinhamento e distribuição avançados, layout absoluto livre, listas dinâmicas, temas extensíveis, variantes e instâncias sincronizadas de componentes, auto-layout avançado, funções com escopos e efeitos complexos, regiões editáveis de código e edição bidirecional livre. Checkbox e seletor podem antecipar-se com contrato de eventos aprovado e evidência de equivalência.
- **Critérios de qualidade.** Validar teclado, leitor de tela, contraste, DPI e atalhos em Tauri real. Medir interação de canvas e inicialização de Monaco em fixtures pequenas e próximas dos limites atuais, incluindo 200 nodes e 500 conexões. Comparar com baseline na mesma máquina antes de definir orçamento. Repetir persistência Rust, conflitos, undo/redo e ausência de histórico/runtime no manifesto quando a mudança tocar o documento. As suítes de [Designer](../../tests/e2e/designer.spec.ts), [lógica](../../tests/e2e/logic.spec.ts), [Código](../../tests/e2e/code.spec.ts), [Depuração](../../tests/e2e/debug.spec.ts) e [equivalência](../../tests/codegen/differential.test.ts) são pontos de partida.
- **Dependências preservadas.** Homologação Windows integral da 1D, durabilidade física sob perda de energia, corrida externa residual sem CAS, RustSec, instalação/desinstalação limpa e mensagem WebView2 continuam abertas. Preservar limites de sandbox, exportação, escala e acessibilidade. A 1E-A segue suspensa por dependência de laboratório, com 1E-B em NO-GO. A 1F e a implementação da 1G aguardam autorização.

**Primeiro incremento recomendado.** Aprovar apenas a fatia 1G-A de Inspector categorizado e paleta de nodes a partir de porta. Demonstrá-la com um projeto v3, ligação válida em uma única transação, recusa acessível de porta incompatível, undo e navegação do diagnóstico até Monaco. Usar o resultado para dimensionar o restante do shell antes de qualquer mudança de formato.
