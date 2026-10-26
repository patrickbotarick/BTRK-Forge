# Relatório de engenharia — Fase 0

Data: 26/10/2026, America/Sao_Paulo. Produto: BTRK Forge / BTRK Studio. Status: entregue para revisão técnica, **Go com ressalvas**; não constitui aprovação da fase nem autorização da Fase 1.

## Resumo executivo

Foi possível construir e executar um shell Windows Tauri, editar um grafo com Rete, persistir um modelo independente, executar controle e dados tipados, visualizar uma tela com estado em preview isolado e produzir uma aplicação controlada independente para web e Windows. Builds de produção e pacotes NSIS foram gerados para Studio e contador. A capacidade essencial funciona sem IA; teste de produção executou o evento com o navegador offline.

Recomendação: Tauri 2/Rust, React/TypeScript, Rete como adaptador, Zod + JSON versionado, Blueprint Core independente e preview sem bridge nativa. Electron foi comparado somente por documentação, sem protótipo, consumo medido ou build. O isolamento atual serve a um interpretador declarativo fechado; não autoriza código arbitrário, plugins ou conteúdo gerado por IA.

## Ambiente e versões reais

Diretório: `C:\Projetos_VS_code\BTRK Forge`. A pasta estava vazia; nenhuma cópia do repositório oficial foi encontrada nas pastas de projetos verificadas. Clone do repositório remoto vazio confirmado por `git ls-remote` e `git clone`.

| Item | Versão detectada |
|---|---|
| Sistema | Windows build 10.0.26300, x64, conforme RuntimeInformation/Tauri |
| PowerShell de execução | 7.6.5 |
| Node / npm | 24.11.1 / 11.6.2 |
| pnpm | 11.25.0, detectado por Tauri; não utilizado para instalar |
| Rust / Cargo | 1.99.0 / 1.99.0, stable-x86_64-pc-windows-msvc |
| Git | 2.54.0.windows.1 |
| C++ Build Tools | Visual Studio 2022, 17.14.37710.0 |
| WebView2 | 155.0.4283.62 |
| React / React DOM | 19.3.1 |
| TypeScript / ESLint / typescript-eslint | 6.0.3 / 10.13.0 / 8.72.1 |
| Vite / plugin React | 8.3.5 / 6.1.2 |
| Rete / area / connection / React renderer | 2.0.6 / 2.3.2 / 2.0.5 / 2.1.2 |
| Monaco / DOMPurify | 0.56.0 / 3.4.17 (override de segurança) |
| Zod / tsx | 4.6.7 / 4.23.15 |
| Vitest / Playwright | 5.0.5 / 1.64.1 |
| Tauri CLI / crate / tauri-build | 2.12.4 / 2.12.5 / 2.7.4 |
| wry / tao | 0.57.1 / 0.37.2 |
| Empacotamento | NSIS 3.13 + nsis_tauri_utils 0.5.3, baixados e verificados pelo Tauri |

Fontes: comandos de versão, `npm view`, `npm ls --depth=0`, `tauri info`, registro WebView2, `vswhere` e dois Cargo.lock. A descrição de versão do Windows preserva a identificação da API, sem inferir edição comercial. Inventário reproduzível em `npm run audit:environment`.

## Experimentos 0A–0I

| Etapa | Executado e evidência | Limite |
|---|---|---|
| 0A Ambiente/Git | Verificação das ferramentas, registro WebView2 e compilação MSVC real; clone vazio, main local inicial e branch específica | CIM bloqueado no sandbox; leitura alternativa suficiente; sem instalação global |
| 0B Studio | Shell React pt-BR com identidade, navegação, canvas, propriedades e host Tauri; abertura/fechamento observados no Windows | Navegação contém apenas o exemplo; fontes propostas usam fallback local |
| 0C Blueprints | Evento, constantes/variáveis, soma/comparação, condição e atribuição; portas tipadas, dois ramos, round trip, migração e erros | Um evento/tela; sem loops/async/funções executáveis |
| 0D Editor | Criação de constante, conexões via sockets, arraste, zoom, enquadramento, posição salva e reconstrução após reload | Demais tipos são predefinidos ou editados via JSON; sem catálogo completo/undo/remoção de nodes |
| 0E Preview | Modelo controla título/texto/cor, botão atualiza estado via Worker, viewports desktop/web/celular; frame de origem opaca e CSP | Celular é simulação responsiva; worker não é sandbox para código livre |
| 0F Exportação | Bundle web de produção em servidor estático sem Vite; hosts Windows independentes e NSIS; contador nativo incrementou com Studio fechado | Exportador apenas do exemplo controlado; não houve instalação em VM limpa ou publicação |
| 0G Segurança/SDK | Capabilities vazias, nenhuma API nativa/plugin, validação estrita, canais limitados; helper Node separado testado; contratos de SDK documentados | Sem sandbox SO para builds arbitrários ou auditoria exaustiva |
| 0H IA/updates | Interfaces tipadas e estratégia de credenciais/diff/aprovação/rollback/assinaturas/canais/versionamento independente | Nenhum provedor, segredo, updater ou serviço configurado |
| 0I Consolidação | Comparação fundamentada Tauri/Electron, arquitetura e plano de Fase 1 | Sem benchmarks comparativos de memória/CPU/startup |

## Qualidade e resultados

- Typecheck e lint aprovados.
- Vitest: **19 testes aprovados** (18 domínio/schema + 1 integração de helper).
- Playwright de desenvolvimento: **4 testes aprovados**, abrangendo nodes, propriedade, estado, viewports, isolamento, salvamento/abertura, arraste/zoom/reconexão, rascunho incompleto e corrupção.
- Playwright de produção: **2 testes aprovados** (exportação independente e Studio com CSP/Monaco/preview/offline).
- Build web do Studio e exportação aprovados. Monaco é lazy loaded; bundle do editor ~2,62 MB sem gzip, aviso de chunk grande permanece registrado.
- Dois builds Tauri release e pacotes NSIS aprovados. `cargo test --locked` dos dois hosts compila e termina com **zero casos de teste Rust**; testes do domínio são TypeScript. `cargo fmt --check` aprovado nos dois projetos.
- Smoke Windows por controle da janela: Studio abre, mostra grafo, alterna ao preview, incrementa `0→1` com trace `click→branch→assign` e fecha. Contador abre com Studio fechado, incrementa `0→1` e fecha. As capturas/textos da sessão documentam a observação; não foi alegado teste de instalação.
- npm audit final: **zero vulnerabilidades reportadas**, após correção transitiva. Inspeção de segredos por padrões conhecidos e configuração de permissões sem achados. RustSec/cargo-audit não executado; compilação de Cargo não substitui auditoria de vulnerabilidades.

[Validação detalhada e evidências](../qa/VALIDACAO_FASE_00.md). Relatórios JSON brutos e screenshots são regeneráveis em `artifacts/`; evidências resumidas portáveis ficam em `docs/qa/evidence/`.

## Problemas encontrados e resolução

1. Rede do sandbox não resolveu Git/npm; comandos de rede rodaram com elevação revisada. Diretório `.git` era somente leitura no perfil; operações Git autorizadas usaram o mesmo mecanismo. Nenhum arquivo pessoal foi alterado.
2. TypeScript 7.0.2 não atende peer `<6.1.0` do analisador instalado. Selecionado 6.0.3; nenhum `--force`/`--legacy-peer-deps`.
3. Monaco 0.57.0 e 0.56.0 traziam DOMPurify vulnerável. Override 3.4.17, auditoria novamente limpa e editor executado em produção. Caminhos de import foram ajustados aos exports reais da biblioteca.
4. Primeiro build Rust falhou pela ausência de `icons/icon.ico`. Ícone local gerado a partir do símbolo F e build repetido com sucesso.
5. Primeira tentativa de Playwright no sandbox deixou servidor inacessível/porta ocupada; processos da própria tarefa foram encerrados e testes repetidos com acesso ao loopback.
6. Primeiro teste de Monaco sofreu recarga de otimização de dependências; prebundle explícito resolveu, e versão de produção foi testada separadamente.
7. Teste inicial de reconexão usou gesto incorreto do preset clássico. Foi corrigido para remover conexão pela entrada e criar de saída→entrada, conferindo modelo após cada ação.
8. Revisão adicionou rejeição de nomes herdados como sockets, orçamento contra DAG exponencial e preservação explícita de rascunho corrompido, com testes dedicados.

As falhas históricas acima foram resolvidas. Pendências abaixo não são testes aprovados.

## Riscos e ressalvas

Persistência atual é JSON + localStorage, sem transação nativa/concorrência; sandbox de builds e plugins hostis ainda precisa de implementação; exportador é específico do exemplo. Nenhum teste de máquina limpa, instalação/desinstalação, assinatura Authenticode, atualizações/rollback reais, performance de grandes grafos, DPI/acessibilidade ou suporte macOS/Linux. Código tradicional livre e sincronização bidirecional código↔nodes permanecem decisões de produto futuras. SQLite, Electron e updater foram avaliados somente como arquitetura/documentação.

## Git e entregáveis

Origin: `https://github.com/patrickbotarick/BTRK-Forge.git`. Branch: `codex/phase-00-foundation`. Base local `main`: commit inicial `377bb2e`, somente README/.gitignore. Nenhum merge, force push ou tag. O remoto foi confirmado vazio antes do clone. O estado final e SHA devem ser conferidos com:

```powershell
git status --short --branch
git remote -v
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase-00-foundation
git log --oneline main..HEAD
```

Inventário: README/.gitignore/.gitattributes; configurações npm/TS/Vite/lint/test; módulos `packages`; Studio e host Rust; ferramentas/helper/exportador e host Windows independente; testes; sete documentos obrigatórios, segurança e evidências. A lista por caminho está em [arquivos alterados em relação à main](../qa/evidence/ARQUIVOS.txt). Dependências instaladas, builds, caches, schemas regeneráveis e dados pessoais não são arquivos de entrega.

Publicação da branch é a etapa final autorizada pelo complemento. O SHA final e a correspondência local/remota constam na entrega da sessão e são verificáveis no GitHub; não se grava um SHA autorreferente dentro do próprio commit. [Plano detalhado da Fase 1](../ROADMAP.md).
