# Fase 1G-B3-B — resolução nativa de assets e gates pendentes

**Decisão proposta. NO-GO para integrar a 1G-B3-B completa.** A branch entrega a resolução somente leitura de objetos preexistentes. A importação e a publicação de objetos permanecem desabilitadas. Nenhum formato foi habilitado para importação.

## Resolução implementada

O comando local project_resolve_asset exige sessão ativa, ID declarado e revisão do manifesto. O Rust confere o manifesto em disco antes e depois, recusa sessão em recuperação e deriva o nome assets/sha256/<hash>.png do registro validado. O comando tem permissão específica para a janela local main e admite uma resolução em andamento por vez. A resposta binária pertence à chamada que forneceu sessão, ID e revisão. A interface e o iframe ainda não consomem o comando.

No Windows, cada componente fixo do caminho é aberto individualmente com NtCreateFile relativo a um handle de diretório autorizado. A abertura final de cada segmento desabilita reparsing. Tipo, atributos e número de links são conferidos pelo handle. Os handles permanecem vivos até a leitura terminar. A leitura tem teto de 8 MiB declarados mais um byte de detecção de excesso. Comprimento, SHA-256, assinatura e dimensões IHDR precisam corresponder ao manifesto. O resultado é um snapshot opaco. Validação completa do conteúdo e canonicalização continuam dependentes do decoder. [Referência NtCreateFile](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntcreatefile)

IDs distintos com o mesmo hash resolvem o mesmo objeto, sem criação automática de entradas ou arquivos. Ausência de objeto é distinguida de referência lógica inválida e de falha de integridade. A resolução não escreve no disco. O recibo de sessão continua conservador até uma resolução explícita. Manifestos v4 e o bloqueio de Salvar como com recursos seguem o contrato anterior.

## Limitações e próximo gate

O próximo incremento de 1G-B3-B precisa provar um decoder de PNG, JPEG e WebP estáticos com limite de entrada, memória, tempo e simultaneidade. Só então habilitar normalização e publicação relativa por handle, com temporário exclusivo, verificação, no-clobber, teto físico e teste de falhas. Em seguida, validar Save As com transporte integral antes de publicar o manifesto. A coleta de órfãos depende de uma política que considere referências, backups e histórico. Os objetos são preservados nesta entrega.

A [validação](../qa/VALIDACAO_FASE_01G_B3_B.md) classifica os gates individualmente. A 1G-B3-C não foi iniciada. Permanecem pendentes as homologações Tauri da 1G e Windows integral da 1D. A 1E-A segue suspensa, a 1E-B em NO-GO e a 1F sem início. As ressalvas históricas de persistência, durabilidade, RustSec, instalação limpa, WebView2, sandbox e distribuição continuam abertas.
