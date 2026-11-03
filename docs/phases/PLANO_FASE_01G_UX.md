# Plano da Fase 1G-UX — Workspace e editores

**Proposta em revisão.** Base e8f0216f8f27738da8ca1072f3dd7b09b5405804. Recomendação GO COM RESSALVAS para UX-A após aprovação, com o escopo restrito a divisórias e recolhimento.

## Auditoria do Studio

A janela Tauri é configurada para 1440 × 920, com mínimo de 1000 × 700. O CSS impõe mínimo de 980 × 680 ao shell, com mudanças de densidade em 1200 e 1100 px. A janela nativa de desenvolvimento foi localizada. A avaliação dos editores preenchidos e das larguras abaixo é estática. Falta medir área cliente, escala do Windows e comportamento com um projeto descartável.

| Área | Implementação atual | Efeito e ponto a validar |
| --- | --- | --- |
| Shell e barras | main.tsx concentra seleção de modo, sessão, operações de projeto, status, console e navegação. Grid de 224 / flexível / 260 px, cabeçalho de 76 px, barra de projeto de 48 px e rodapé de 30 px | Comandos globais e de contexto competem por largura. Testar truncamento do caminho, rótulos em português, conflito no disco e foco ao alternar modos |
| Designer | Grade própria de 220 / flexível / 270 px. Biblioteca e hierarquia compartilham a coluna esquerda. Inspector categorizado à direita. Canvas rolável com artboard e viewport compartilhada | Largura nominal central de 950 px em 1440 px, antes de paddings. Em 1000 px, com laterais de 190 e 235 px, cai para 575 px. O artboard com max-width pode reduzir a representação de 768 px. A árvore trunca nomes e divide a rolagem com o catálogo |
| Inspector | Controles tipados, categorias, seleção múltipla, valores mistos, validação e atalhos de árvore já existem | Campos verticais consomem altura e IDs longos quebram linhas. Busca e recolhimento podem reduzir deslocamento sem mudar comandos. Conferir foco e anúncio de erro |
| Blueprint | Graph e Rete 2 têm catálogo, parâmetros, conexões tipadas, paleta contextual a partir de portas, seleção, pan, zoom, enquadramento e navegação para código e componentes | Workbench tem inspector próprio de 280 px e mantém propriedades externas. Barras podem quebrar linha. A navegação atual do Designer pode criar evento. Distinguir localizar de criar em trabalho futuro |
| Código | Monaco já usa automaticLayout. TypeScript gerado somente leitura, revisão e navegação por origem. Modelo JSON separado, com rascunho e salvaguardas de troca de aba | Redimensionar contêiner exige verificar seleção, posição de rolagem e navegação por node. Preservar rascunho e seus bloqueios |
| Preview | Iframe isolado com sandbox allow-scripts e viewport compartilhada | Mínimo de 350 px de altura no iframe pode exigir rolagem interna em janela curta. Divisórias não podem perder captura de ponteiro sobre iframe ou reconectar o runtime a cada movimento |
| Depuração e saída | Depuração possui histórico, valores, trace, rollback e links para Blueprint e Código. Console mantém controles de execução, status e variáveis com altura fixa por modo | Console pode ocupar 158 px em janela de 700 px antes de barras e toolbars. Priorizar rolagem local, recuperação por teclado e status acessível mesmo com console fechado |

O Studio já usa botões, foco visível e navegação de árvore por teclado. A reestruturação deve mapear Tab, setas, Escape, Ctrl/Shift de seleção, Delete, undo/redo, atalhos Monaco/Rete e modais. Testar 1440 × 920, 1000 × 700, 1920 × 1080 e escalas Windows de 100%, 125% e 150%. Medir pixels CSS disponíveis, foco, clipping, scroll por região e tempo de resize com as mesmas fixtures.

## Arquitetura e regiões

Manter main.tsx como dono de sessão, navegação e comandos existentes. Extrair um WorkspaceShell React para regiões e divisórias, sem transferir estado de documento para o layout. Usar IDs estáveis de painéis, limites de tamanho, rolagem interna e estado de visibilidade separado da seleção. Proteger Monaco, Rete e iframe contra remount durante resize, colapso ou movimentação dentro do mesmo modo. Quando uma ferramenta exigir remontagem, restaurar foco e estado de visualização no seu adaptador. Em janela estreita, preservar uma área central útil e recolher laterais por prioridade com restauração acessível. Separar dimensões da janela do Studio das dimensões e Flex do aplicativo criado.

| Região | Designer | Blueprint | Código |
| --- | --- | --- | --- |
| Superior | Comandos globais do projeto e modos | Mesmos comandos | Mesmos comandos |
| Esquerda | Projeto, biblioteca e hierarquia | Catálogo, navegação e busca | Navegação de origens |
| Centro | Canvas e barra de viewport | Grafo e ferramentas contextuais | Monaco e abas existentes |
| Direita | Inspector contextual | Propriedades de node e diagnóstico | Origens e diagnósticos quando úteis |
| Inferior | Saída e acesso ao Preview | Saída e Depuração | Saída e Depuração |

Na UX-A manter as ferramentas nas posições atuais e introduzir o shell por modo. Na UX-B permitir mover e agrupar por abas em zonas válidas, com alternativa por menu e teclado. O menu Exibir recupera painéis e restaura o padrão. Preview e Depuração continuam disponíveis como modos. A ativação em região secundária exige manter uma única instância por ferramenta e validar ciclo de vida antes de habilitar.

Na UX-B guardar preferências locais da interface em chave exclusiva e versionada. O contrato inclui versão, modo, IDs reconhecidos, regiões, ordem, aba ativa, estado recolhido e tamanhos limitados. Validar leitura, descartar IDs desconhecidos, normalizar tamanhos ao monitor atual e restaurar padrão quando dados estiverem inválidos. Persistir após concluir a interação. Layout nunca participa de manifesto, migração de projeto, estado sujo, histórico de documento ou código gerado.

## Alternativas de implementação

| Opção | Benefício | Custo e recomendação |
| --- | --- | --- |
| CSS Grid e divisor React próprio | Três divisórias em regiões fixas, nenhuma dependência nova, estado diretamente controlado | Implementar captura de ponteiro, cancelamento, teclado, ARIA e mínimos. Recomendado para UX-A com escopo fixo. Evitar criar motor de docking |
| react-resizable-panels | Grupos, separadores acessíveis por teclado, limites e recolhimento | Candidato se casos de ponteiro e teclado exigirem manutenção desproporcional. Validar React do projeto, WebView2, licença e empacotamento offline. A biblioteca de splits não resolve sozinha a política de docking |
| Dockview | Docking, grupos, abas, drag-and-drop e API de layout | Candidato para UX-B atrás de adaptador. Testar movimentação por teclado, foco, drag sobre iframe, descarte, CSP e restauração de Monaco/Rete. Restringir à janela atual. A aprovação de dependência deve preceder adoção |

As capacidades foram avaliadas pela documentação. Compatibilidade e acessibilidade no Forge precisam de prova em Tauri. [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels/blob/main/README.md) · [Dockview](https://dockview.dev/docs/)

## Design system e fluxos

Preservar o tema escuro, a marca e o laranja de destaque. Definir tokens CSS de superfície, texto, borda, foco, seleção, erro e sucesso. Começar com Segoe UI e fallback atual, texto de controles de 13 px, ajuda de 12 px, mono de 13 px no editor, escala de espaçamento 4/8/12/16/24 px e área de interação confortável para divisórias. Usar ícones com nome acessível, seleção por borda e estado textual além da cor, foco visível, tooltips acessíveis por teclado e sem informações essenciais exclusivas de hover. Validar contraste com meta de 4,5:1 para texto normal e 3:1 para indicadores essenciais. Manter a ordem visual coerente com a ordem de Tab.

No Designer, zoom e pan são estado de câmera transitório. Calcular fit com tamanho real do artboard e container e manter seleção e viewport. Exibir guia de inserção e realce de Container válido, separar seleção de arraste e fornecer comando de menu equivalente. Mapear drop para pai e índice pelo comando validado. Testar ciclos, pai folha e seleção de pai e descendente. Alças, em incremento posterior da UX-C, só convertem para dimensões em pixels do contrato vigente, com prévia e uma transação no commit. Manter auto, fill e Flex disponíveis. Posicionamento absoluto exige fase própria. Separar Biblioteca e Hierarquia visualmente, com categorias, pesquisa e descrições, e melhorar seções recolhíveis, busca e estados vazios no Inspector.

No Blueprint, reutilizar a paleta por porta e seus filtros tipados. Unificar pesquisa por contexto com categorias e motivo de incompatibilidade. Exibir feedback acessível de conexão inválida e preservar criação e conexão atômicas. Priorizar enquadrar seleção, navegação por evento e teclado, seleção múltipla com movimento agrupado reversível, menu contextual e destaque do trace. Separar ação explícita de criar evento da navegação. Reutilizar os IDs e links de origem de Código e Depuração. Novos nodes e semântica permanecem sujeitos a contratos próprios.

## Incrementos e aceite

| Fase | Dependências e contrato | Aceite e testes | Risco principal |
| --- | --- | --- | --- |
| UX-A | Shell, CSS e divisórias fixas. Tamanhos transitórios com clamp, colapso e reset. Preservar mounts e comandos | Ajustar duas laterais e console com mouse e teclado, recolher e reabrir com foco previsível. Unitário de clamp, E2E de layout e atalhos, smoke Tauri com tamanhos mínimo e padrão. Manifesto e estado sujo invariantes | Conteúdo cortado, pointer capture sobre iframe, conflito de atalhos |
| UX-B | UX-A e decisão separada sobre biblioteca. Modelo local versionado e registro de painéis por modo | Mover e agrupar abas por gesto e menu, recuperar painéis, reabrir Studio, recuperar JSON local inválido e restaurar padrão. E2E de persistência local e Tauri com Monaco, Rete e Preview | Remount e perda de foco, listeners duplicados, layout local incompatível |
| UX-C | UX-A, UX-B para destinos dinâmicos. Comandos de designer-core e contrato Flex v4 | Zoom/pan/fit, inserir e mover entre Containers, reordenar com guia, cancelar e desfazer. Testes de cálculo e transação, E2E com viewports, reabertura e equivalência Designer/Preview | Drop em coordenadas escaladas, mudança de seleção, lote parcial |
| UX-D | UX-A, Rete, paleta, IR v1 e navegação existente. Edições em lote só por comando validado | Criar por porta, recusar incompatibilidade, mover seleção numa transação, enquadrar, navegar evento → node → código → trace. E2E e regressão diferencial para confirmar semântica | Reconexões inválidas, atalhos em inputs, trace ou mapa de origem obsoleto |
| UX-E | A–D aprovadas. Matriz de ambiente, semântica e acessibilidade | Comparar baseline e candidato em Tauri, DPI e teclado, leitor de tela, perfis com grafos pequenos e grandes. Verificar manifesto, persistência Rust, undo/redo, equivalência, CSP e funcionamento offline | Aprovar com evidência somente Chromium ou fixture pequena |

O primeiro incremento recomendado é UX-A, começando pelo Designer e console, com os demais modos adaptados após verificar a mesma interface de layout. O plano exclui alterações em schema v4, migrações, Blueprint Engine, IR v1, codegen, runtime, persistência Rust e Preview isolado.

## Conciliação do roadmap

A 1G-C histórica continua responsável por múltiplas telas e navegação persistente. A UX apenas prepara regiões e seleções de interface. A 1G-D continua responsável por grupos e comentários persistentes, auto-layout avançado, reutilização e funções. UX-D cobre interação com grafos existentes e pode reutilizar ferramentas quando esses contratos forem aprovados. UX-E gera evidência de usabilidade e regressão para a 1H, que mantém os gates de distribuição, instalação limpa, assinatura e auditoria. [Planejamento 1G](PLANO_FASE_01G_EDITOR_VISUAL.md) · [Roadmap](../ROADMAP.md)

A 1G-B3-B segue suspensa por laboratório e em NO-GO. As homologações Tauri da 1G e Windows integral da 1D permanecem abertas. A 1E-A segue suspensa, a 1E-B em NO-GO e a 1F sem início. Preservam-se as ressalvas de persistência, RustSec, instalação limpa, WebView2, sandbox e distribuição. UX-A depende de aprovação deste plano e de critérios de regressão, sem depender de broker, exportação ou importação física de assets.
