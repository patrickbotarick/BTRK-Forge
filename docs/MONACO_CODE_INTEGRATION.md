# Monaco e navegação Blueprint ↔ TypeScript — Fase 1D-C

Estado: implementada e candidata à revisão, sem encerramento oficial ou integração à main. O TypeScript é exibido, não executado pelo Studio. A 1D-D não foi iniciada.

## Arquitetura

Documento v3 → Worker dedicado → lowerBlueprint/IR v1 → generateTypeScript v1 → artefato validado → Monaco somente leitura. O editor JSON continua separado e usa o documento original. Não há segunda fonte persistente de verdade, alteração de schema ou geração gravada automaticamente no manifesto.

| Módulo | Responsabilidade |
|---|---|
| packages/typescript-codegen/generation.worker.ts | API real de lowering/geração, diagnósticos e medição fora da thread da interface |
| packages/code-navigation/protocol.ts | Schemas estritos, versões, limites e validação de coordenadas dos artefatos |
| packages/code-navigation/generation-client.ts | Debounce, cancelamento, pedidos monotônicos, descarte de resultados antigos, timeout e retry |
| packages/code-navigation/index.ts | Consulta direta e inversa de origens UTF-16, independente do Monaco/React/Rete |
| apps/studio/src/use-generated-code.ts | Vincula revisão do documento e sessão nativa ao ciclo do gerador |
| apps/studio/src/Code.tsx | Visualizações, editor TS, destaques, ocorrências, navegação e estados |
| apps/studio/src/ModelJson.tsx | Editor JSON existente extraído, mantendo aplicação validada e callback de rascunho |
| apps/studio/src/Graph.tsx e rete.ts | Ver código do node; seleção e enquadramento do node de retorno |

O interpretador, Worker de execução, Preview, runtime semântico e código público do gerador 1D-B não foram modificados. O novo Worker apenas gera texto/mapas. Não carrega nem executa o TypeScript emitido.

## Área Código e Modelo JSON

A aba principal chama-se Código, com TypeScript gerado e Modelo JSON distintos. O TypeScript usa linguagem/sintaxe TypeScript registrada no Monaco, linhas numeradas, tema escuro, fonte monoespaçada e opções readOnly/domReadOnly. A sinalização aria-readonly contempla o EditContext nativo recente do Chromium; teclado não altera o conteúdo. A mensagem de tentativa de edição é em português.

O editor JSON conserva valor inicial, callback, Aplicar JSON e Reverter edição JSON. É criado ao ser visitado e permanece montado ao alternar as visualizações na mesma visita à aba Código, preservando seu buffer. Não há aplicação implícita ao alternar. No Windows, rascunho JSON pendente mantém os bloqueios existentes, desabilita o histórico da área Código e impede navegar ao Blueprint até aplicar/reverter. O TypeScript representa o documento aplicado, não o rascunho, e essa distinção aparece em mensagem explícita.

Sair da aba Código encerra os modelos Monaco; rascunhos nativos continuam no estado de projetos existente. O laboratório web mantém seu comportamento anterior de edição JSON não aplicada ao sair da aba. Não há round-trip, edição livre de TS, linguagem arbitrária ou execução do código exibido.

Os botões Desfazer código/Refazer código operam o mesmo histórico de documentos Design/Blueprint, limitado a 100 transações. Não são edições textuais do TS. Navegação e geração não acrescentam transações nem disparam salvamento.

## Revisão, cache e sessão

A chave local combina sessão/atividade/ID do projeto com serialize(documento sem metadata). Alterações efetivas do documento, inclusive undo/redo, invalidam o artefato. Mudanças apenas de metadata ao salvar não regeneram. A revisão SHA-256 exibida é a revisão da IR gerada, conforme a 1D-B; posições, estilos ou nome podem invalidar a chave local sem mudar esse hash semântico.

A geração começa na primeira visita a Código. Depois disso acompanha edições, mesmo com a aba temporariamente oculta. Navegação, seleção e renderização sem alteração da chave reutilizam o artefato. Após fechamento, o cache é limpo; abrir outro projeto ou uma nova sessão do mesmo manifesto exige nova geração.

O cliente aplica debounce de 120 ms, mantém somente um trabalho vigente e termina o Worker anterior ao invalidar seu documento/sessão. IDs de pedido são monotônicos. A resposta precisa corresponder ao Worker, pedido e chave atuais, ter versões/formato válidos e origens exatamente dos nodes daquele documento. Trabalho cancelado/resultado antigo nunca é aplicado. O contador “Geração anterior descartada” indica trabalho em andamento invalidado, não número de alterações do projeto.

O hook mascara o artefato antigo já no render, antes dos efeitos. O Monaco limpa texto e decorações em layout effect antes da pintura. Assim, projeto incompleto, troca, fechamento ou undo não deixam código antigo anunciado como válido. Seleções de nodes removidos também são limpas antes da pintura; IDs ainda existentes são preservados.

Um watchdog de 10 segundos interrompe o gerador e oferece Gerar novamente. Esse limite é de geração, distinto do watchdog de execução declarativa de dois segundos, que não foi alterado. Workers são encerrados depois da resposta, no erro, na invalidação ou ao desmontar. O artefato atual fica em memória; não há cache ilimitado por projeto.

## Origens e navegação

Mantida a convenção 1D-B: offsets UTF-16 base zero, intervalos [start,end), linhas/colunas base um e LF. O protocolo valida limites, coordenadas e papéis; não persiste linhas como identidade.

- Blueprint → código: selecionar um node e usar Ver código do node abre Código, revela sua definição e destaca todos os trechos associados. O seletor Ocorrência distingue definição/chamadas por linha e permite visitar cada uma.
- Código → Blueprint: clicar/selecionar um trecho atualiza a seleção do node e os destaques. Localizar no Blueprint, Ctrl+Enter ou duplo clique no trecho abre o grafo e enquadra o node. A seleção simples mantém o código aberto para leitura.
- Seleção inversa: menor intervalo significativo que contenha a seleção inteira; em empate, call precede definition e o ID fornece desempate estável. Uma chamada dentro da definição do chamador aponta para o chamado. Intervalos são de fim exclusivo.
- Código auxiliar fora das definições não inventa origem: limpa a seleção e não oferece localização incorreta. Uma seleção que cruza origens sem intervalo contenedor também não escolhe arbitrariamente um node.
- Revelação programática é suprimida no callback de seleção do Monaco; seleção vinda do código não é imediatamente substituída pela definição. Isso evita ciclos e preserva a chamada escolhida.

Rete usa enquadramento da área visual, sem mover nodes ou alterar posições no documento. Se a inicialização do canvas ainda estiver em curso, a solicitação vigente é aplicada quando o editor fica pronto. IDs ausentes são recusados e seleções/revelações de nodes removidos são descartadas.

## Estados e diagnósticos

Sem projeto aberto, permanece a tela vazia existente e não há Worker/código ativo. A área Código distingue gerando, atualizado, documento editável incompleto e falha. Exibe SHA-256 e tempo dentro do gerador, separado do tempo de download/inicialização.

Entradas ausentes retornam mensagens por node e ações Localizar node. Erros globais não recebem origem fictícia. Erros de schema/processo/resposta excessiva são apresentados em português, sem stack trace bruto. Projetos incompletos exibem editor vazio e diagnósticos, sem conservar código de outra revisão. Não há diagnóstico avançado de execução, breakpoint ou step-by-step nesta subetapa.

## Worker, Monaco e segurança

Mensagens do gerador são limitadas a 3 milhões de caracteres; o código do artefato a 2 milhões, até 200 origens, 1200 intervalos totais e 500 diagnósticos. O lowering mantém os limites do projeto. O Worker não recebe cliente nativo, tokens de sessão Rust ou bridge Tauri, apenas o documento e ID de pedido.

A configuração CSP não foi ampliada: worker-src self/blob, assets locais e renderizador fixo do Preview permanecem. Não há eval, carregamento do código exibido como módulo, comandos, dependências novas ou permissões nativas adicionais. O import runtime.js presente no texto emitido não é resolvido/executado pela visualização.

Monaco usa o worker básico existente e tokenização TypeScript local. Não foi ativado um servidor de linguagem/checagem livre de TypeScript no editor; diagnósticos desta tela são de lowering/geração. Os testes diferenciais 1D-B continuam fazendo typecheck/compilação reais no harness. A busca padrão do Monaco foi carregada, permitindo localizar chamadas via Ctrl+F.

O compiler Worker de produção mede aproximadamente 3,67 MB antes da compressão. A área de código permanece lazy; o compilador não é importado pela thread principal. O custo de download/inicialização existe e não se confunde com o tempo de transformação mostrado. Em um ensaio de 200 nodes, a interface continuou emitindo eventos de heartbeat; valores específicos e screenshots ficam no QA, sem promessa universal de latência.

## Forge Code Demo — roteiro de homologação

1. Criar Forge Code Demo por Novo projeto e escolher uma pasta no diálogo Windows.
2. Pelo Design, criar Container, título Text, Input de nome, Button Confirmar e Text de resultado. Usar o fluxo visual da Fase 1C, com variável Nome string/binding, eventos click/change, leitura do Input, empty, condição e concatenação da saudação.
3. Conectar ramo vazio à mensagem Digite seu nome, ramo preenchido a Olá, Nome! e onChange à atualização do resultado. Usar catálogo/Inspectors/formulário de conexões; não construir JSON como substituto desse fluxo.
4. Selecionar um node compartilhado e usar Ver código do node. Conferir definição e chamadas na visualização somente leitura.
5. Selecionar uma chamada no código e usar Localizar no Blueprint. Conferir seleção e posição do canvas; clicar em código auxiliar não deve escolher origem.
6. Alterar parâmetro no Inspector; conferir nova geração e revisão. Desfazer/refazer deve atualizar código/mapas pelo histórico original.
7. Adicionar node incompleto ou desconectar entrada; conferir editor limpo e diagnóstico localizável. Desfazer deve restaurar o documento executável sem aplicar mapa anterior.
8. No Preview, exercitar vazio e nome Ana. Salvar explicitamente, fechar e reabrir; conferir IDs, grafo, geração e Preview, sem campos de código/mapa no manifesto.

Automação UI/driver Rust constrói esse fluxo pela interface, verifica ambos os ramos, navegação, rascunho JSON, salvamento, reabertura e troca de projeto. Não equivale a homologação completa na janela WebView2 real. O estado dessa etapa manual é registrado separadamente no relatório/QA.

## Limites preservados

Permanecem abertos: durabilidade física sob falha de energia; corrida externa residual sem CAS de kernel; RustSec; instalação/desinstalação limpa; mensagem histórica WebView2 sem correção demonstrada. Mantidos também harness sem sandbox de SO, corpus não exaustivo, runtime companheiro fixo, revisão CommonJS antes de TS7, ausência de edição bidirecional, exportação geral e execução de código arbitrário. Integração visual não resolve essas pendências nem inicia a 1D-D.
