# Relatório de engenharia — Fase 1A

Data: 26/10/2026, America/Sao_Paulo. Produto: BTRK Forge / BTRK Studio. Estado: implementação concluída, candidata à aprovação. Recomendação: **Go com ressalvas**, dentro das garantias documentadas. A Fase 1B não foi iniciada.

## Resultado entregue

O Studio Windows gerencia projetos em pastas escolhidas pelo usuário, sem conta, nuvem ou IA. Novo, Abrir, Salvar, Salvar como e Fechar projeto estão integrados ao shell. Nome/localização, estados de carregamento/gravação, indicador de alterações, avisos de descarte e recuperação são exibidos em português. Projetos podem ficar fora do repositório; os testes usam pastas temporárias por segurança e reprodutibilidade.

O modelo da Fase 0 foi preservado: IDs, telas/componentes, propriedades, variáveis, tipos, nodes, conexões e posições persistem. Valores do runtime e trace não são parte da definição salva. Fixtures históricas, migração conhecida e rejeição de versões futuras estão compartilhadas entre frontend e Rust. Rascunhos com entradas desconectadas podem ser salvos; o executor mantém a exigência de grafo completo.

Foi implementado um serviço Rust com manifesto único, diretório autorizado por diálogo, sessão opaca, arquivo temporário exclusivo no mesmo volume, sincronização solicitada ao SO, substituição controlada, backup da versão anterior válida, verificação pós-gravação e restauração explícita. Não há filesystem genérico acessível ao frontend ou interpretação de caminhos/comandos provenientes do projeto.

## Repositório e ambiente

- Caminho local: `C:\Projetos_VS_code\BTRK Forge`.
- Origin: `https://github.com/patrickbotarick/BTRK-Forge.git`.
- Base `main` local/remota conferida: `baa3654703c06cd6d17095347311e70e518ed6b7`.
- Branch exclusiva: `codex/phase-01a-project-persistence`, criada a partir da `main` sincronizada e inicialmente limpa.
- Sem reset destrutivo, force push, merge na main, release, tag ou exclusão de branches.
- Windows x64 build 10.0.26300, WebView2 155.0.4283.62, C++ Build Tools 17.14.37710.0, Node 24.11.1/npm 11.6.2, Rust/Cargo 1.99.0.

Dependências acrescentadas e efetivamente compiladas: cliente Tauri 2.12.4, rfd 0.17.2, jsonschema 0.60.1 e windows-sys 0.61.2. O host usa Tauri crate 2.12.5/CLI 2.12.4. SHA-256 usa sha2 0.10.9, IDs usam uuid 1.29.0 e os testes usam tempfile 3.27.0, travados nos lockfiles. Stack React/TypeScript/Rete/Monaco da fase anterior mantida; nenhuma instalação global necessária.

## Estrutura relevante

| Caminho | Responsabilidade |
|---|---|
| `packages/project-schema/` | Zod e JSON Schema derivado versionado |
| `packages/forge-core/project-document.ts` | Criação de documento, metadados, leitura/gravação validada |
| `packages/native-persistence/src/model.rs` | JSON Schema e semântica do grafo no backend |
| `packages/native-persistence/src/paths.rs` | Caminhos, handles, reparse/hard link, locks e APIs Windows |
| `packages/native-persistence/src/lib.rs` | Sessão, gravação, hashes, backup, recuperação e erros |
| `packages/native-persistence/src/tests.rs` | Testes reais e injeção controlada de falhas |
| `apps/studio/src-tauri/src/projects.rs` | Comandos restritos, seletores e registro de sessões |
| `apps/studio/src-tauri/capabilities/project.json` | ACL da janela principal local |
| `apps/studio/src/project-client.ts` | Cliente IPC tipado; driver acessível somente em mode=test |
| `apps/studio/src/use-projects.tsx` | Ciclo de projeto, conflitos e confirmações |
| `tests/fixtures/projects/` | Formatos históricos, futuro e referência inválida |
| `tests/native-e2e/` | UI conectada à biblioteca Rust real |

Contratos completos em [formato v1](../FORMATO_PROJETO_V1.md) e [arquitetura v0.2](../ARQUITETURA_V0_2.md). Inventário de caminhos em [arquivos da entrega](../qa/evidence-01a/ARQUIVOS.txt). Não foram criados pacotes vazios ou fontes concorrentes de projeto.

## Testes e evidências

- **24 testes TypeScript aprovados:** 19 testes anteriores de núcleo/helper e 5 de documento/compatibilidade/schema derivado.
- **19 testes Rust de persistência aprovados**, além de **1 teste do host** para rejeição de sessão não autorizada.
- **4 testes Playwright de regressão** da Fase 0 aprovados.
- **5 testes Playwright de projetos**, com serviço Rust e arquivos reais, aprovados. Apenas os seletores são substituídos por diretórios de teste; armazenamento não é mock.
- **2 testes de produção** aprovados, com CSP e aplicação exportada em servidor estático sem Vite.
- Typecheck, lint, cargo check, cargo test, cargo fmt e builds web/Windows aprovados. Studio e contador independente receberam executáveis e NSIS; não foram instalados em máquina limpa.
- Auditoria npm: zero vulnerabilidades reportadas. Scanner de padrões de segredos/permissões: sem achados no escopo verificado. Não houve auditoria RustSec ou auditoria exaustiva de segurança.

Smoke WebView2 real: criou projeto com seleção nativa, alterou propriedade, acrescentou node, salvou, fechou/reabriu o projeto, verificou aviso ao fechar a janela, executou Salvar e continuar, encerrou o processo e recuperou os dados numa nova instância. Foram preservados ID, 9 nodes e as conexões. Os seletores do Windows foram confirmados manualmente pelo usuário por falha do controle de UI; as ações no WebView e as verificações em disco foram automatizadas. Um perfil temporário e porta local de depuração foram usados somente no processo de teste, sem configuração permanente ou opção de depuração acrescentada ao produto.

Evidências: [QA detalhado](../qa/VALIDACAO_FASE_01A.md) e `docs/qa/evidence-01a/`. Logs brutos, perfis e projetos de teste ficam em `artifacts/`, ignorados. A captura nativa mostra apenas o conteúdo do WebView do próprio aplicativo; árvores de diálogos que exibem arquivos pessoais não são publicadas.

## Garantias e riscos residuais

Conflitos anteriores à gravação recusam escrita, mantêm memória e disco e permitem recarga/cópia/cancelamento. Entre o último hash e a troca existe uma janela estreita para um escritor externo não cooperativo: o serviço compara os bytes efetivamente substituídos, retorna conflito explícito, preserva o snapshot externo e o backup, mas o principal pode já conter a proposta do Studio. Isso foi testado por injeção deliberada e não é apresentado como CAS de kernel ou ausência universal de sobrescrita transitória.

As garantias de integridade se limitam às APIs e ao filesystem real exercitado. Temporário validado + sync_all + troca no mesmo volume reduz o risco de bytes parciais; não garante persistência física frente a energia/disco/controladora. Manifesto e backup não formam uma única transação. Resultados incertos preservam temporários e exigem recarga/conferência. Snapshots órfãos têm recuperação limitada e política determinística, sem garantia de escolher o mais recente e sem limpeza automática de evidências antigas.

Também permanecem: matriz de filesystems e caminhos longos/DPI, instalação em máquina limpa, assinatura/atualizações, auditorias adicionais e proteção contra adversário com a mesma autoridade local/administrativa. Sandbox de execução arbitrária e exportação generalizada continuam fora desta subfase. A política recusa UNC, rede mapeada e reparse points; não é sandbox geral do sistema operacional.

## Problemas encontrados e resolução

1. Interrupção solicitada pelo usuário durante o controle do computador: automação interrompida e retomada somente após autorização explícita, sem descartar alterações do repositório.
2. Cache/geometria do controle de diálogo nativo: criação/reabertura repetidas com seleção assistida pelo usuário; fluxo nativo final executado e confirmado, sem inferir sucesso de tentativas anteriores.
3. Harness inicial supunha um caminho fixo e reutilizava contexto de depuração: ajustado para nome/perfil/porta únicos e localização efetivamente retornada. Artefatos de tentativas ficaram ignorados.
4. Compilação simultânea de exemplo enquanto o executável de testes estava aberto no Windows causou LNK1104. Testes de biblioteca passaram a usar `--lib`; repetição isolada aprovada, sem mudar a implementação para contornar uma falha de teste.
5. Revisão adicionou rejeição explícita de documentVersion futuro, detecção pós-troca de corrida externa e recusa de unidades de rede. Testes reais/Rust e pacote final regenerados; fluxo de UI do smoke não foi alterado por esses ajustes finais do serviço.
6. Suítes Playwright paralelas compartilhavam a pasta padrão de traces, causando ENOENT na finalização. As configurações passaram a usar diretórios studio/native/production separados, e as suítes afetadas foram repetidas.

## Continuidade recomendada

Submeter esta branch à revisão antes de qualquer integração. Para Fase 1B, priorizar revisão da política de snapshots/recuperação e UX de erros, testes físicos/VM e auditoria do broker, depois o escopo de editor definido pelo responsável. Não habilitar código arbitrário ou plugins apenas porque existe acesso controlado a projetos. Nenhuma atividade da Fase 1B foi iniciada.

O commit final e o link da branch publicada são informados na entrega da sessão e verificáveis por `git rev-parse HEAD`, `git status --short --branch` e `git ls-remote origin refs/heads/codex/phase-01a-project-persistence`. Não se grava dentro do próprio commit um SHA autorreferente.
