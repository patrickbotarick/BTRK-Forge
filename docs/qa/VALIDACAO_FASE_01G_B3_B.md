# Validação — Fase 1G-B3-B

A validação usa fixtures sintéticas em filesystem Windows real. Os testes provisionam um PNG fixo diretamente na pasta de teste. A aplicação oferece resolução somente leitura. A classificação GO abaixo se limita ao controle exercitado, e a recomendação da subetapa completa permanece NO-GO.

| Gate | Controle e evidência observada | Limitação | Estado |
|---|---|---|---|
| Importação autorizada | Nenhum comando de importação foi habilitado. | Seleção nativa e ingestão não exercitadas. | NO-GO |
| Isolamento de caminhos | A busca exige ID declarado e revisões correspondentes. IDs de traversal, absolutos e ausentes foram recusados. Abertura usa nomes fixos por handle. | Escopo Windows local. | GO no escopo testado |
| Proteção contra links | Junction para fora e hard link com bytes idênticos foram recusados. Canário externo permaneceu intacto. | Symlink independente e outros tags de reparse não exercitados nesta rodada. | GO COM RESSALVAS |
| Resistência a corridas | Handles vivos impediram renomear o ancestral e renomear ou sobrescrever o arquivo no cenário testado. Manifesto externamente alterado gera conflito. | Corridas de criação tardia de hard links e matriz de versões/filesystems não homologadas. | GO COM RESSALVAS |
| Decodificação limitada | Nenhuma decodificação foi habilitada. O resolver checa assinatura e dimensões IHDR dos bytes opacos. | PNG, JPEG e WebP continuam desabilitados para importação. Limites de memória e tempo do decoder não demonstrados. | NO-GO |
| Publicação de objetos | A resolução é somente leitura. | Normalização, temporário, publicação sem sobrescrita, quota física e falhas de publicação ainda não exercitados. | NO-GO |
| Integridade | Objeto correto foi resolvido. Alteração de mesmo tamanho, truncamento e ausência foram recusados. | Hash e cabeçalho comprovam correspondência ao manifesto, sem validar a estrutura PNG completa ou provar origem canônica. | GO COM RESSALVAS |
| Salvar como | Bloqueio com recursos foi confirmado sem criar pasta de destino. | Transporte integral pendente. | NO-GO para transporte |
| Resolução por ID | Dois IDs declarados resolveram o mesmo hash. Revisão antiga recusada após salvar. Reabertura resolveu o mesmo objeto. | IPC foi compilado no host, sem execução em janela Tauri nesta rodada. | GO COM RESSALVAS |
| Recuperação | Regressão de backup e falhas do manifesto em filesystem real. Resolver recusa sessão em recuperação. | Recuperação de publicação de assets e coleta de órfãos permanecem pendentes. | NO-GO para publicação |

## Suítes

| Verificação | Resultado |
|---|---|
| Rust persistência | 30 aprovados, incluindo os três novos cenários nativos de assets |
| Rust host | 1 aprovado, Cargo fmt aprovado |
| TypeScript | 179 aprovados |
| UI/Rust | 14 aprovados |
| Typecheck, lint, build web e scanner estático | Aprovados. Vite reportou aviso de tamanho de chunks. |

A regressão TypeScript inclui migrações v0–v4, paridade estrutural com a matriz Rust, IR, execução de TypeScript gerado, eventos, bindings e undo/redo. A evidência UI/Rust usa Chromium e driver Rust para projetos sem assets e fica separada do teste nativo de resolução. A homologação Tauri permanece pendente.
