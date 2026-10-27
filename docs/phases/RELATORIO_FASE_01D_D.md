# Fase 1D-D — Runtime Diagnostics, Debugging & Final Validation

Estado: implementada e candidata à revisão com **GO COM RESSALVAS**, sem encerramento oficial da Fase 1D ou autorização de outra fase. Base main `36b3458bf04205d818dbc3e7aa13396a85be476b`; branch exclusiva `codex/phase-01d-d-debugging-validation`. A main permanece preservada.

## Entrega

Nova aba Depuração com histórico cronológico, detalhes por evento, variáveis tipadas iniciais/atuais, propriedades transitórias de Input/Text, leituras, avaliações repetidas, ramos, ações, mudanças before/after e resultado de transação. Há limpeza explícita, indicação de truncamento/evicção, falhas globais e interrupções sem trace inventado. Botões por origem navegam ao Blueprint/canvas ou ao TypeScript atual, sem dirty ou transação undo. Badges textuais de seleção, execução e erro complementam cores.

`packages/runtime-debug` define o protocolo v1, coletor limitado e histórico. `blueprint-core/runtime.ts` aceita observador opcional e registra a execução real; a resposta original continua idêntica. `execution.worker.ts` valida o envelope separado; `use-runtime.ts` associa sessão/pedido, controla retenção e recusa callbacks antigos. `Debug.tsx` apresenta os dados; `main.tsx` coordena seleção, `rete.ts` adiciona rótulos, estilos/i18n identificam 1D-D.

Schema v3, migrações, IR v1, Codegen v1, semantic-runtime, persistência Rust, Designer, Monaco/JSON, Preview sandbox, CSP, permissões, dependências/lockfiles e exportador histórico foram preservados. O TypeScript não executa no Preview. Não há breakpoint, step-into/over, edição pelo painel, exportação nova ou código arbitrário.

## Garantias e limites

O pedido recebe debugSession UUID; o Worker responde `{version:1,session,reply,debug}`. A resposta legada é mantida dentro do envelope, sem novo campo obrigatório compartilhado com o programa compilado. Schemas validam versões, identidade, tipos, finitude, ordem, limites e coerência do resultado. O Studio confere Worker, sessão e pedido ativo. Não foi instrumentado o executor TypeScript; equivalência de trace entre executores não é alegada. Diferenciais 1D-B e oráculos/mutações continuam executando e comparando o contrato original integralmente.

Trace retém prefixo de até 200 entradas e aproximadamente 64 mil unidades UTF-16 serializadas por evento; outcome e contador de omissões ficam fora do prefixo. Histórico retém até 20 eventos e 512 mil unidades serializadas, removendo os mais antigos. Não equivale a limite exato do heap. Fila de 32, orçamento de 10 mil visitas e watchdog de 2 s permanecem ativos. O histórico é transitório e não contém tokens Rust, credenciais ou dados de serviços externos.

Ingestão registra Input antes da variável, sincroniza bindings e precede ações. Expressões reavaliadas não são memoizadas; escrita só é observada após avaliar o valor. Atribuições sem mudança também são registradas. Rollback compara o trabalho com a base pós-ingestão, reverte ações e conserva a ingestão. O diagnóstico não acrescenta visitas ou efeitos semânticos. Cancelamento/timeout registra interrupção sem afirmar rollback confirmado ou trace parcial que não chegou.

Limpar histórico mantém runtime; reiniciar limpa ambos e cria nova sessão. Interrupção/timeout reiniciam Worker/estado e mantêm o registro da interrupção. Mudança efetiva de documento/projeto, fechamento e nova sessão Rust descartam histórico; salvar metadata não o faz. Histórico antigo selecionado é distinguido do estado atual das tabelas. Detalhes em [RUNTIME_DEBUGGING](../RUNTIME_DEBUGGING.md).

## Validação

**204 testes aprovados, zero falhas finais e zero ignorados**: 136 TypeScript, 26 Rust persistência, 1 Rust host, 25 E2E web, 11 integrações UI/Rust e 5 produção/CSP. Os 14 novos testes de domínio comparam resposta instrumentada/original, ordem independente, leitura após escrita, reavaliação, ramos, ingestão, rollback, falhas, Unicode/-0, validação, truncamento real e retenção. Há 5 novos E2E, 1 UI/Rust e 1 produção. Testes existentes de FIFO e resposta antiga receberam verificações do histórico.

Typecheck, lint, cargo check/fmt dos dois crates, build web, build Windows/NSIS, exportação web histórica, scanner e npm audit aprovados. Scanner sem ocorrências nos padrões conhecidos; npm audit sem vulnerabilidades reportadas. Integridade Git sem corrupção. [QA e evidências](../qa/VALIDACAO_FASE_01D_D.md).

Falhas intermediárias: uma expectativa de origem indicava greeting, mas o overflow ocorria antes em concat; o oráculo foi corrigido. O init script de fixture alcançava iframe sandbox e tentava localStorage; foi limitado à janela superior, preservando o sandbox. Uma extensão do tipo de histórico exigiu completar nodeId no registro de erro global. A primeira suíte UI/Rust executada durante edições/HMR teve 3 timeouts (8 aprovados), incluindo DOM destacado e aviso de createRoot; a repetição integral com fontes estabilizadas passou 11/11. Não se contabilizam tentativas intermediárias como aprovação final.

## Forge Debug Demo e Windows

O Demo completo foi construído pela UI com driver Rust: Container, título Text, Input com binding string, Button, resultado Text, click/change, vazio/concatenação e atualização de Text. Foram executados ramos vazio/preenchido, onChange, histórico, inspeção, navegação Blueprint/Código, falha controlada com mutação anterior/rollback, reinício, salvamento e reabertura. Manifesto e estado salvo permaneceram íntegros e sem campos debug/runtime. As cópias para abertura manual derivam dos manifestos salvos nessa UI, não de JSON artesanal usado para fingir construção visual.

Janela Windows real: executável desta fase foi aberto e observado. O seletor nativo continuou retornando “element is not available in cached app state”; tentativas por coordenadas também não focaram o campo esperado. O usuário auxiliou na seleção. A primeira abertura encontrou bloqueio de uso exclusivo; posteriormente a janela observada carregou Forge Code Demo da 1D-C, 8 nodes, em vez do Forge Debug Demo de 21 nodes, apesar das confirmações recebidas. O estado observado prevalece sobre a intenção da seleção.

**Não foi homologado integralmente o Forge Debug Demo na janela Tauri.** Não se declara execução nativa real dos dois ramos, rollback, navegação/inspeção completos ou reabertura desse Demo em novo processo. O roteiro manual remanescente da 1D-C também não é classificado como resolvido. Os 11 testes UI/Rust e as capturas de navegador são provas separadas, sem substituição por alegação de homologação WebView2. O NSIS foi gerado, não instalado/desinstalado.

## Ressalvas e continuidade

Permanecem abertas: (1) durabilidade física sob falha de energia; (2) corrida externa residual sem CAS de kernel; (3) RustSec; (4) instalação/desinstalação limpa; (5) mensagem histórica WebView2 no encerramento.

Também persistem homologação manual integral, harness sem sandbox de SO, corpus diferencial finito, runtime companheiro fixo, revisão CommonJS antes de TS7, custo inicial/escala limitada do compilador Worker, edição bidirecional, exportação geral, assinatura/atualização e matriz ampla de escala/DPI/acessibilidade. O prefixo truncado não contém toda execução e não há snapshots históricos completos, apenas mutações registradas e estado atual. Falhas/interrupções do Worker não oferecem trace parcial em streaming.

Recomendação: **GO COM RESSALVAS para revisão restrita da 1D-D**, com lacuna Windows explícita. Para encerrar a Fase 1D completa: revisar esta implementação, completar/aceitar formalmente as lacunas de homologação e decidir os limites residuais. Não há aceite de distribuição comercial ou autorização de fase seguinte. Publicar somente a branch; sem merge automático, force push, tag ou release. SHA final local/remoto é informado na entrega, evitando autorreferência neste documento.
