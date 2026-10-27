# Formato de projeto BTRK v1

Registro histórico da Fase 1A. O Studio da Fase 1B lê este formato por migração explícita em memória para o [formato v2](FORMATO_PROJETO_V2.md); só Salvar materializa a nova estrutura. As garantias e limitações de persistência abaixo continuam aplicáveis.

Contrato da Fase 1A. A única fonte persistente de verdade é **`project.btrk.json`**, dentro da pasta escolhida pelo usuário. React, Rete e Monaco não participam do formato. Schema executável: `packages/project-schema/index.ts`; JSON Schema versionado: `packages/project-schema/project.schema.json`.

## Campos e versões

| Campo | Contrato |
|---|---|
| `id` | Identidade estável do projeto; novos projetos usam `project-` + UUID. Não muda ao salvar ou fazer uma cópia com Salvar como |
| `name` | Nome de apresentação, até 100 caracteres; nome da pasta é escolhido separadamente e limitado a 80 unidades UTF-16 |
| `version` | SemVer do documento/projeto, controlado pelo autor; não é contador de salvamentos |
| `schemaVersion` | Versão estrutural, atualmente 1; versão 0 tem migração conhecida; versões futuras são recusadas |
| `screens` | Uma tela, título e componente botão com ID, texto, cor hexadecimal e evento `button.click` |
| `variables` | ID, nome, tipo number/string/boolean e valor inicial compatível |
| `graph` | Nodes de domínio, posições e conexões por IDs/portas; nenhum objeto interno do Rete |
| `functions`, `resources`, `dependencies` | Arrays vazios reservados; conteúdo ainda é rejeitado |
| `permissions` | Arrays web/windows vazios; projeto não concede capacidades nativas ao host |
| `distribution` | appId, versão e canal stable/beta do aplicativo gerado |
| `metadata` | Opcional para legado; novos projetos incluem `documentVersion: 1`, createdAt/updatedAt ISO UTC e savedBy `BTRK Forge` |
| `compatibility` | Opcional para legado; format `btrk-project`, minimumStudio `0.0.1`, requiredFeatures `["project-persistence-v1"]`, platforms `["web","windows"]` |

`metadata.documentVersion` identifica a versão do envelope do documento, não o número de edições. `schemaVersion` identifica a estrutura do modelo. O hash SHA-256 dos bytes abertos é a revisão de concorrência da sessão; não é armazenado como um segundo documento de projeto. Como o Studio ainda usa versão de desenvolvimento 0.0.1, o requisito explícito de recurso é necessário para distinguir suporte à persistência nativa; o número sozinho não identifica builds históricos da Fase 0.

IDs são únicos dentro do projeto, começam por letra e possuem até 80 caracteres. Save, Save As, abertura, serialização e migração preservam IDs de telas, componentes, variáveis, nodes e conexões. Criar outro projeto gera outra identidade. Salvar como cria outra pasta com a mesma identidade e conteúdo, sem redefinir conexões; um recurso futuro de fork pode ter outra política, sem alterar esta silenciosamente.

## Validação e edição incompleta

Zod valida no frontend; Rust valida novamente usando JSON Schema gerado de Zod e regras semânticas próprias. Um teste compara o schema gerado ao contrato TypeScript, e fixtures históricas são consumidas pelos dois lados. Alterar o contrato exige `npm run schema:generate`, revisão do JSON e testes.

Os validadores recusam campos desconhecidos, tipos incompatíveis, IDs duplicados, referências ausentes, sockets desconhecidos, múltiplas entradas, fan-out de controle e ciclos. Rascunhos podem ter entradas ainda desconectadas, para permitir edição e salvamento; executar continua exigindo o grafo completo conforme a Fase 0. Essa opção de validação não altera as regras do executor.

Limites: 2.000.000 bytes nas fronteiras nativas e de gravação, 200 nodes, 500 conexões e 100 variáveis, além dos limites de texto/posição do schema. O importador textual legado também mantém o limite de caracteres existente e o seletor verifica o tamanho do arquivo. Valores transitórios do Worker, trace e contador em execução não entram no manifesto; somente a definição e os valores iniciais persistem.

## Compatibilidade e migração

- `phase0-v1.json`: abre preservando conteúdo e IDs; metadados opcionais não são inseridos implicitamente.
- `phase0-v0.json`: em memória, altera schemaVersion 0→1 e preenche functions vazio se ausente/nulo. O disco só muda após salvamento explícito.
- schemaVersion futuro ou documentVersion futuro: erro localizado; não se restaura automaticamente um backup de versão antiga.
- JSON malformado ou estrutura inválida: não substitui o projeto em memória. Ao abrir uma pasta com cópia íntegra, ela pode ser apresentada em memória como recuperação pendente; o disco permanece intacto até confirmação.
- Capacidade/forma desconhecida: schema estrito recusa. Clientes antigos com schema estrito podem recusar documentos novos com metadata/compatibility, em vez de descartá-los silenciosamente.

Fixtures versionadas: `tests/fixtures/projects/phase0-v0.json`, `phase0-v1.json`, `future.json` e `invalid-reference.json`. Não há migração destrutiva, downgrade automático ou inferência de tipos a partir do editor visual.

## Organização da pasta

```text
Minha pasta de projeto/
  project.btrk.json                  manifesto canônico
  project.btrk.backup.json           versão anterior válida, quando existente
  .forge.lock                       exclusão entre instâncias; permanece após fechar
  .forge-write-<UUID>.tmp            temporário da tentativa de gravação
  .forge-old-<UUID>.tmp              bytes substituídos durante uma troca ainda não concluída
  .forge-displaced-<UUID>.json        bytes preservados por restauração explícita
```

Temporários não são fontes concorrentes de verdade. Em operação bem-sucedida, o temporário vira o manifesto e o snapshot anterior vira o backup. Falhas antes de tentar a troca limpam somente o UUID criado pela chamada; interrupção simulada e resultado incerto preservam candidatos. Abertura só procura os nomes reconhecidos, limita a enumeração a 1.000 entradas e a avaliação a 32 snapshots, e valida os bytes antes de oferecer recuperação. Backup fixo tem prioridade; snapshots órfãos usam ordem determinística, sem promessa de selecionar a versão cronologicamente mais recente.

A restauração pede confirmação, verifica novamente hashes e preserva os bytes deslocados sem promover um manifesto corrompido ao backup íntegro. Snapshots órfãos/deslocados não são apagados automaticamente; a fase não implementa histórico ilimitado ou substituto do Git. O arquivo `.forge.lock` tem seu handle exclusivo liberado ao fechar/encerrar o processo; sua presença física não significa bloqueio ativo.

Abrir projeto seleciona exatamente `project.btrk.json`. JSONs demonstrativos com outros nomes continuam disponíveis por **Importar JSON**, seguidos de **Salvar como** para materializar a pasta nativa. Importar/exportar usa o mesmo modelo, sem introduzir outro formato de projeto.
