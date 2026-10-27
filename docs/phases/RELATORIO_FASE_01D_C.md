# Fase 1D-C — Monaco Integration & Blueprint ↔ Code Navigation

Implementação candidata a **GO COM RESSALVAS**, sujeita à revisão do responsável. Não constitui encerramento oficial nem autorização de integração à main. A 1D-D não foi iniciada.

## Base e escopo

Base main `78b856fad0ff556aa205481f7dd46c239bbf8e8a`; branch exclusiva `codex/phase-01d-c-monaco-integration`. Schema v3, IR v1, contratos do gerador v1, interpretador, runtime semântico, persistência Rust, CSP, permissões e dependências foram preservados. O Preview continua executando o Blueprint declarativo em seu Worker; não executa o TypeScript exibido.

Entregues: aba TypeScript somente leitura e aba Modelo JSON com edição validada; geração real por lowering/gerador existentes em Worker dedicado; estados de geração, revisão SHA-256, diagnósticos localizáveis, rejeição de resultados obsoletos e cache da sessão; navegação node → definição/chamadas e seleção código → node/canvas; histórico original e proteção do rascunho JSON nativo.

## Arquitetura e módulos

O novo pacote interno `packages/code-navigation` concentra resolução determinística de intervalos UTF-16, validação do protocolo e ciclo de vida do cliente. `generation.worker.ts` usa as APIs reais de IR/codegen sem executar seu resultado. `use-generated-code.ts` liga documento/sessão ao cliente. O editor anterior foi preservado em `ModelJson.tsx`; `Code.tsx` hospeda as duas vistas, Monaco readonly, ocorrências e diagnósticos. `main.tsx` coordena seleção/sessões e `Graph.tsx`/`rete.ts` enquadram a origem sem gravar posição ou histórico. Estilos e rótulos seguem a interface Foundry em português. Detalhes em [contrato da integração](../MONACO_CODE_INTEGRATION.md).

A chave de sincronização usa sessão e documento serializado sem metadata de salvamento. O SHA do artefato é a revisão semântica produzida pelo gerador. Resultados só chegam à interface para a chave e pedido atuais. Mudanças invalidam código/mapas antes de sua reaplicação; Worker anterior é encerrado, há debounce de 120 ms e timeout de 10 s. A primeira visita carrega a área lazy; mudar abas/seleção e salvar apenas metadata não regeneram. Fechar/trocar projeto invalida a sessão.

Intervalos são UTF-16 com início inclusivo/fim exclusivo, linha/coluna base 1. Seleções sobrepostas escolhem o menor intervalo que contém a seleção, com desempate estável. Código auxiliar sem origem limpa a seleção. Definição é laranja e chamadas são mint; a lista permite navegar por todas as ocorrências. Localizar, Ctrl+Enter e duplo clique levam ao Blueprint e enquadram o node. Seleção simples permanece no Código. Não há edição bidirecional.

## Validação e evidências

Revalidação: **183 testes aprovados, zero falhas finais e zero ignorados**: 122 TypeScript (incluindo diferenciais), 26 Rust persistência, 1 Rust host, 20 E2E web, 10 integrações UI/driver Rust e 4 produção. Typecheck, lint, cargo check/fmt, builds web/Windows, exportação controlada web, scanner e npm audit aprovados. Audit npm: zero vulnerabilidades reportadas. Scanner: zero ocorrências nos padrões conhecidos, sem substituir auditoria. [QA detalhado](../qa/VALIDACAO_FASE_01D_C.md).

O Forge Code Demo automatizado foi construído pela interface, sem JSON artesanal no fluxo normal, com Input/Button/Text, binding string, condição, eventos e 21 nodes/conexões. Foram verificados os ramos, persistência real Rust, navegação sem dirty, rascunho JSON protegido, reabertura e segundo projeto. Outros testes cobrem UTF-16, múltiplas chamadas, auxiliar, remoção, conexões, undo/redo, incompletos, falhas, atrasos e CSP estática real de produção.

Windows real: novo executável Tauri compilado nesta execução abriu no WebView2. Com auxílio do usuário no seletor nativo, criou-se Forge Code Demo; Input e Text foram adicionados ao exemplo pela UI e salvos. O Blueprint de 8 nodes/8 conexões gerou TypeScript (34 ms mostrados nessa observação), destacou `sum`, identificou a chamada de `counter` na linha 103 e enquadrou esse node pelo botão Localizar. O indicador permaneceu salvo durante a navegação. Screenshots reais acompanham o QA.

**Limitação manual:** o roteiro completo de binding/condição, edição/undo, Preview e reabertura não foi repetido integralmente na janela Tauri. O seletor de pasta não era operável pelo controlador (elemento indisponível no cache); o usuário realizou a seleção. Evidência automatizada UI/Rust e capturas de navegador são identificadas separadamente e não substituem essa homologação manual restante. Não se declara homologação completa Windows nem instalação limpa.

## Problemas corrigidos durante a execução

- Compatibilidade ES2022: ordenação sem `toSorted`; contrato readonly do artefato compatível com schemas.
- Invalidação de seleção na troca de sessão/remoção de node feita antes da pintura, evitando corrida inicial observada em E2E.
- Monaco moderno usa Native EditContext: verificação acessível com aria-readonly e tentativa real de edição bloqueada, sem presumir textarea.
- Busca Monaco carregada explicitamente; teste usa o campo Find realmente exposto. Paste real no teste JSON evita autoindentação artificial da digitação de múltiplas linhas.
- Verificação de produção observa criação/encerramento do Worker; não tenta avaliar Worker já encerrado após entregar o artefato.

Falhas intermediárias foram investigadas e corrigidas; as contagens acima correspondem às últimas suítes completas. Três repetições do cenário de navegação também passaram, sem serem somadas como testes únicos.

## Ressalvas abertas

1. Durabilidade física sob falha de energia.
2. Corrida externa residual sem CAS de kernel.
3. Auditoria RustSec pendente.
4. Instalação/desinstalação em máquina limpa pendente.
5. Mensagem histórica WebView2 no encerramento, sem correção demonstrada.

Continuam: harness sem sandbox de SO; corpus diferencial não exaustivo; runtime companheiro fixo; revisão CommonJS antes do TypeScript 7; exportação generalizada, assinatura/atualizações e edição bidirecional pendentes. Diagnóstico avançado e inspeção da 1D-D não foram implementados. A tela oferece diagnósticos de lowering/geração, sem language server TypeScript completo. Compilador Worker de aproximadamente 3,67 MB tem custo inicial; ensaio de 200 nodes não constitui SLA ou matriz de escala/DPI/acessibilidade.

## Recomendação e entrega Git

**GO COM RESSALVAS para revisão da 1D-C**, com homologação manual restante explicitamente aberta. Publicar somente a branch de implementação; preservar main, branches anteriores e evidências. Sem merge, force push, tag ou release. A decisão de encerramento e eventual integração à main exige autorização posterior. O SHA final verificável é fornecido na entrega Git e pode ser obtido com `git rev-parse HEAD`; não é gravado neste próprio commit para evitar autorreferência.
