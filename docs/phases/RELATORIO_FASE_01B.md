# Relatório de implementação — Fase 1B

Data: 26/10/2026, America/Sao_Paulo. Produto BTRK Forge / BTRK Studio. **Estado: implementada, candidata à aprovação. Recomendação: GO COM RESSALVAS.** Não houve início da Fase 1C ou integração automática à main.

## Resultado entregue

O Studio oferece uma primeira experiência funcional de construção visual por componentes, sem edição manual de JSON no fluxo normal. O modo Design reúne biblioteca, hierarquia, canvas selecionável e Inspector. Text, Button, Input e Container possuem propriedades tipadas, estilos limitados, layout por containers e persistência no documento oficial do projeto.

Criar, selecionar, editar, reordenar, mover, duplicar, remover e desfazer/refazer são operações reais. O domínio edita uma cópia e valida o documento antes de adotá-lo. Duplicar remapeia IDs/pais da subárvore; remover pede confirmação, inclui descendentes e preserva a lógica do Blueprint. O histórico guarda até 100 transações em memória, mantém-se após salvar conteúdo equivalente e é reiniciado ao adotar conteúdo diferente. Seleção e viewport não são persistidos.

Inserção funciona por botão ou arraste do catálogo para o canvas; usa o container selecionado ou o pai do elemento selecionado. Seleção ocorre pelo canvas ou pela árvore. Subir/Descer reordenam irmãos; Mover para transfere entre containers/raiz e recusa ciclos. O Inspector atualiza o modelo e o canvas, com erros em português. Delete pede remoção, Ctrl+S salva, Ctrl+Z e Ctrl+Shift+Z/Ctrl+Y operam o histórico fora de campos editáveis. Painéis têm rolagem; redimensionamento interativo não foi implementado.

## Arquitetura e tecnologias

React/TypeScript e CSS existentes sustentam o shell e o Inspector; o renderizador compartilhado usa DOM allowlisted. Zod/JSON Schema e validação semântica do domínio/Rust garantem o contrato. Rete e Blueprint Core continuam responsáveis pelo grafo e execução declarativa; Monaco permanece disponível para inspeção/edição avançada validada, sem ser necessário para montar a demonstração.

O backend Tauri/Rust reutiliza sessões, seletores, limites de workspace, hashes, escrita, backups e recuperação da Fase 1A. Nenhum comando IPC, permissão genérica, plugin nativo, biblioteca npm ou crate adicional foi introduzido. Os lockfiles permanecem inalterados. A única alteração da CSP do host é o hash do novo script fixo de Preview, além da formatação JSON.

Fontes principais:

| Caminho | Responsabilidade |
|---|---|
| `packages/project-schema/components.ts` | Tipos, propriedades e estilos dos quatro componentes |
| `packages/project-schema/index.ts` | Schema v2 e migração validada v0/v1 |
| `packages/designer-core/` | Regras de árvore, comandos e histórico |
| `apps/studio/src/Designer.tsx` | Catálogo, hierarquia, canvas e Inspector |
| `apps/studio/src/main.tsx` | Integração de modos, transações e atalhos |
| `packages/preview-runtime/visual-renderer.ts` | Renderização compartilhada, sem HTML de projeto |
| `packages/preview-runtime/visual-renderer-source.ts` | Fonte fixa gerada para o iframe isolado |
| `packages/native-persistence/src/model.rs` | Migração e validação de componentes no backend |
| `tests/designer.test.ts`, `tests/e2e/designer.spec.ts` | Domínio e fluxos visuais |
| `tests/native-e2e/projects.spec.ts` | Interface conectada à biblioteca Rust real |

[Arquitetura v0.3](../ARQUITETURA_V0_3.md), [matriz de componentes](../COMPONENTES_FASE_01B.md) e [formato v2](../FORMATO_PROJETO_V2.md) detalham as garantias e os limites.

## Formato e migração

schemaVersion 2 substitui o botão único por uma lista ordenada de componentes com parentId; ela representa a árvore sem manter uma segunda lista children. A tela única conserva ID e título próprio. Somente Container admite filhos. Limites: 200 componentes, profundidade 12, IDs globalmente únicos e propriedades estritas.

A migração valida v1 antes de transformá-lo; preserva ID do projeto/tela/botão, variáveis, nodes, conexões e posições. O botão antigo vira Button raiz vinculado ao evento existente. O documento migrado é validado novamente. O arquivo no disco não muda ao abrir; Salvar materializa v2, mantendo os bytes v1 anteriores no backup. Fixtures antigas e schema v1 congelado são preservados. Versões futuras desconhecidas são recusadas, sem downgrade silencioso.

Layout utiliza direção vertical/horizontal, gap/padding, alinhamento/justificação, auto/fill/pixels, fundo, borda e tipografia. Desktop, web e celular são viewports do mesmo modelo, sem emulação Android. A versão do envelope metadata.documentVersion continua 1, independente da versão estrutural 2.

Button pode disparar o único evento button.click suportado pelo Blueprint existente. Duplicações compartilham deliberadamente o vínculo externo; remover componentes não exclui lógica não relacionada. Input tem valor inicial, placeholder, tipo e disabled; seu valor de Preview é transitório, sem binding de dados ou novos eventos. Recursos indisponíveis são informados no Inspector.

## Preview e segurança

Design e Preview usam o mesmo renderizador. A versão do iframe é gerada da função TypeScript por `npm run renderer:generate` e verificada por teste; `npm run sync:csp` atualiza seu hash estático. Não há eval, CSS/HTML livre ou execução de código do Inspector.

Texto entra por textContent e estilos têm valores limitados pelo schema. O iframe mantém sandbox allow-scripts, origem opaca, MessageChannel e ausência de acesso nativo/storage. O Worker conserva o interpretador declarativo. Testes de produção/CSP, isolamento e texto com aparência de HTML passaram.

## Validação executada

**75 testes automatizados aprovados; zero reprovados e zero ignorados nos resultados finais.**

| Suíte | Aprovados |
|---|---:|
| Vitest: núcleo, documento, helper e Designer | 33 |
| Rust: persistência e componentes v2 | 23 |
| Rust: host Tauri | 1 |
| E2E web: regressão e Design | 8 |
| Interface + biblioteca Rust real | 8 |
| Produção web/CSP/Monaco | 2 |

Typecheck, lint, Cargo check e fmt da biblioteca/Studio passaram. Build web, exportação controlada web e build Windows do Studio passaram; executável x64 e NSIS foram gerados. npm audit reportou zero vulnerabilidades; scanner de padrões de segredos/permissões sem achados no escopo disponível. Nenhuma auditoria RustSec foi executada.

O contador Windows exportado da Fase 0 não foi reconstruído nesta subfase; sua exportação web de exemplo foi testada. O build Windows homologado aqui é o Studio com o novo Designer. A geração do NSIS não é homologação de instalação/desinstalação em máquina limpa.

## Demonstração Windows real

Projeto temporário **Forge Visual Demo**, ID `project-7e1ae24e-0eca-4f63-ab5e-ec92059dc542`, criado pelo fluxo nativo. O usuário selecionou a pasta temporária anterior da auditoria: `E:\Projetos_VS_Code\BTRK Forge\artifacts\continuity-audit\recovery\native-smoke\projects\Forge Visual Demo`. O caminho retornado foi conferido antes da edição; nenhum projeto real foi utilizado.

Sem editar JSON, a interface montou um Container principal, título Text, Input, Button ligado ao evento existente e um segundo Container com Text: seis componentes. Foram editados padding/gap/fonte/conteúdo, executados reordenação, duplicação, remoção e undo/redo, seguido de Preview e salvamento. O botão legado foi removido explicitamente, sem remover seu Blueprint.

O processo release foi fechado e uma nova instância do executável final abriu o manifesto. Documento completo, identidade, IDs, hierarquia, propriedades e o mesmo Blueprint com **8 nodes e 8 conexões** foram conferidos. Preview renderizou os textos/campo e o botão executou o contador 0→1 novamente. O histórico após salvar também foi observado na instância final: editar gap, salvar, desfazer e refazer retornou ao estado Salvo no disco.

As ações foram realizadas no WebView2 do próprio executável, com inspeção independente da janela Windows. O usuário ajudou somente nas duas seleções nativas (pasta e manifesto), devido à limitação conhecida do controle dos diálogos. Perfis e portas de depuração foram temporários, apenas nos processos de teste; não entraram na configuração do produto. Zero pageerrors capturados nos intervalos instrumentados. As duas instâncias foram encerradas após os testes.

Evidências portáveis: [resumo e hashes](../qa/evidence-01b/RESUMO.json), [Designer reaberto](../qa/evidence-01b/native-designer.png) e [Preview nativo](../qa/evidence-01b/native-preview.png). O [QA](../qa/VALIDACAO_FASE_01B.md) contém os procedimentos e distingue os ambientes.

## Problemas encontrados e resolvidos nesta implementação

1. Expectativas antigas de schemaVersion 2 como versão futura foram atualizadas para 99; o teste v0 passou a usar a fixture histórica real, preservando a finalidade da regressão.
2. Rótulos implícitos de textarea/select impediram seleção exata em testes de UI. Foram definidos aria-label explícitos, e os fluxos completos passaram novamente.
3. Um ensaio de regressão observou timeout do Monaco durante a etapa em que arquivos ainda eram alterados. Repetições estáveis e teste de produção passaram; o primeiro ensaio não foi contabilizado como aprovação.
4. A homologação nativa mostrou o histórico reiniciado após save por diferenças de ordem das chaves JSON. A comparação passou a usar serialização do schema sem metadata; undo/redo preserva o envelope atual. Um teste com o recibo Rust real e a repetição na janela final validaram a correção.

## Limitações e riscos residuais

**Permanecem abertos:** durabilidade física sob falha de energia; corrida externa residual entre hash e troca; auditoria RustSec; instalação em máquina limpa; mensagem WebView2 no encerramento. Nenhum foi declarado resolvido pela Fase 1B. A lógica de caminhos/troca/sessões não foi modificada; suas regressões passaram com o novo modelo. O smoke release não instrumentou todo stderr do WebView e não autoriza considerar resolvida a mensagem histórica.

Também permanecem: retenção/seleção cronológica de snapshots, matriz de filesystems/DPI, acessibilidade/performance completas, chunk grande do Monaco, assinatura/atualizações, catálogo ampliado, múltiplas telas, seleção múltipla, estilos livres, breakpoints, binding de Input e exportação generalizada. Não há promessa de IDE completa ou sandbox de SO para código arbitrário.

## Git e entrega

Clone íntegro: `E:\Projetos_VS_Code\BTRK Forge\artifacts\continuity-audit\repository`. Branch: `codex/phase-01b-visual-designer`, criada da main atualizada e inicialmente limpa em `5a38ff5f9ef7dec36ef55bb801fe9fa12a7f95e7`. Origin oficial confirmado e fetch executado antes das alterações. A pasta original sem .git foi preservada.

Commit de implementação/testes: `1201f3eac35b783d1c6a9d3b9ccb290046ec2bd1`. Este relatório, QA, matriz, contratos e evidências compõem o commit documental final. O SHA final e a igualdade local/remota são confirmados na entrega da sessão, evitando SHA autorreferente. A publicação autorizada é somente da branch da Fase 1B; main deve permanecer no SHA acima. Não há merge, force push, release, tag ou início da Fase 1C.

**Recomendação: GO COM RESSALVAS, candidata à aprovação do responsável**, dentro das capacidades e garantias descritas. Não se trata de aprovação automática nem autorização para avançar à próxima fase.
