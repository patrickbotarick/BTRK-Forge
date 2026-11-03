# Contrato proposto de assets visuais — 1G-B3

## Catálogo e formato

O v3 restringe os quatro tipos atuais e exige resources vazio. Panel pode ser um preset de Container em v3, com os mesmos filhos, dimensões, eventos vazios e propriedades Flex. Image, Icon e tokens persistentes exigem v4. A proposta abaixo depende de aprovação e não altera o formato atual.

| Item | Contrato proposto |
|---|---|
| Panel | Entrada de biblioteca que instancia Container com valores existentes de fundo, borda e espaçamento. Persistência e hierarquia idênticas a Container. |
| Image | Props assetId, fit (contain, cover ou fill, padrão contain), alt e decorative. Eventos vazios e sem filhos. Alt obrigatório e não vazio para imagem informativa, vazio para decorativa. Usa width/height auto, fill ou pixels do contrato atual. |
| Icon | Props iconKey de catálogo versionado no código, label e decorative. Eventos vazios e sem filhos. Dimensão e cor do estilo validado. Renderizar vetores fixos da aplicação, com nome acessível quando informativo e ocultação semântica quando decorativo. Chaves removidas exigem compatibilidade ou migração. |
| Tokens | Coleção tipada de cores e propriedades comuns autorizadas. IDs estáveis, referência restrita ao tipo da propriedade e literal atual como fallback. Sem CSS livre, aliases, ciclos ou expressões. Mudança de token atualiza projeções, com remoção explícita das referências ou materialização do fallback em uma transação. Candidato posterior à primeira entrega de assets. |

Exemplo de entrada JSON em resources no v4:

```json
{"id":"asset-123","kind":"image","mediaType":"image/png","sha256":"<64 caracteres hexadecimais minúsculos>","byteLength":12345,"width":320,"height":200}
```

Em TypeScript, Image referencia apenas um AssetId de resources com kind image. A identidade é estável e única no documento, separada do hash de conteúdo. O Rust deriva a localização assets/sha256/<hash>.png dentro do workspace. O manifesto não fornece caminho, extensão livre, URL ou bytes embutidos. Cópias do projeto incluem o manifesto e a árvore assets, com verificação antes da publicação. Um manifesto avulso com referências abre com placeholders e diagnóstico de recurso indisponível.

Proposta inicial de limites por projeto: 64 entradas e 64 MiB de objetos persistidos, 8 MiB por entrada ou saída canônica, 4096 px por eixo, 8 milhões de pixels e orçamento de decodificação e transferência. Medir os valores no laboratório antes da aprovação. Estudar PNG, JPEG e WebP estáticos como entrada, rejeitando animações e formatos divergentes. Decodificar sob limites de memória e tempo, remover metadados e reencodar para PNG canônico. O SHA-256 identifica os bytes efetivamente gravados. SVG do usuário, HTML e URLs ficam fora do contrato.

## Importação, resolução e ciclo de vida

1. O usuário seleciona um arquivo em diálogo nativo. O Rust vincula a importação à sessão ativa e usa o handle selecionado para leitura limitada. Verifica tipo regular, identidade, tamanho e ausência de reparse, reavalia a identidade e os metadados após a leitura e valida a cópia isolada. Mudança observada aborta. A janela residual de mutação concorrente deve ser testada antes do aceite.
2. Dentro do workspace, o Rust abre a raiz e o diretório de assets com controles de identidade e volume, valida cada fronteira e recusa reparse ou hard link. Escreve temporário exclusivo, sincroniza e publica por nome de hash sem substituir objeto existente. Se o destino existir, reutiliza apenas após verificar tamanho, hash e tipo pelo handle. A UI registra o recurso após receber recibo válido da sessão. Falha pode deixar objeto órfão rastreável, mas nunca referência persistida a publicação incompleta.
3. O comando de resolução recebe ID registrado, sessão e revisão, sem caminho. Rust lê bytes verificados com limites e devolve dados ao Studio. A ponte do Preview envia somente bytes raster necessários por MessagePort, vinculados à sessão e revisão. O iframe de origem opaca cria URLs blob efêmeras para Image e revoga na substituição e desmontagem. CSP permite apenas blob em img-src e mantém conexões bloqueadas. Nenhuma URL do projeto, file, protocolo de assets genérico ou chamada Tauri entra no iframe. Respostas antigas são descartadas.
4. Objetos são imutáveis. Undo/redo altera referências e mantém bytes disponíveis. Remoção recusa referências ativas ou exige substituição explícita. Limpeza é separada, sob lock, considerando manifesto, backups recuperáveis, histórico ativo e transações pendentes. Em dúvida, conservar o objeto. Nunca seguir links nem apagar caminhos fornecidos pelo projeto. Save As copia objetos verificados antes de publicar o manifesto de destino. Recuperação lida com sobras da operação anterior.
5. Falta ou corrupção produz placeholder estável com texto alternativo e diagnóstico localizado. O projeto permanece editável e o recurso pode ser relocalizado por importação explícita. Diagnóstico e cache ficam fora do manifesto. No laboratório web, o seletor pode fornecer bytes temporários pelo mesmo contrato de renderização. Referências sem armazenamento nativo disponível exibem placeholder. Persistência web de assets requer decisão própria.

## Matriz de ameaças

| Ameaça | Controle e critério de aceite |
|---|---|
| Traversal, caminho absoluto e acesso externo | ID resolve nome derivado do hash. Rejeitar nomes arbitrários, ADS e escapes. Sondas de leitura e escrita externas devem falhar. |
| Symlink, junction, reparse e hard link | Validar cada diretório e arquivo por handle, tipo, volume, identidade e contagem de links. Fixar diretórios durante operação. Exercitar troca de ancestral, reparse e hard link tardio. Falhar fechado se o ambiente não sustentar o controle. |
| Substituição durante importação ou coleta | Ler e validar os mesmos bytes pelo handle, sem reabrir por caminho. Publicar somente temporário próprio. Testar renomeações, escrita concorrente e destino preexistente. |
| Inválido, corrompido ou excessivo | Assinatura, decoder com limites, quotas e hash. Testar truncamento, bombas de pixels, animação e estouro agregado. |
| Referência quebrada ou ID duplicado | Validação semântica TS/Rust. Placeholder para bytes ausentes ou adulterados. Recusar ID repetido e referência lógica sem entrada correspondente. |
| Remoção em uso | Verificar referências, backups e histórico. Exercitar falha parcial e reabertura. |
| Conteúdo ativo ou remoto | Catálogo fechado, bytes raster validados e CSP. Testar que scripts, SVG arbitrário, HTTP e acesso nativo permanecem bloqueados. |

A autorização de assets é uma fronteira de persistência e renderização. A qualificação de sandbox de build da 1E permanece independente.

## Decisões implementadas na 1G-B3-A

O v4 fixa image/png como mídia declarada, IDs globais, SHA-256 minúsculo com 64 caracteres, 64 entradas, até 8 MiB por entrada, 64 MiB agregados por declaração, 4096 px por eixo e até 8.000.000 de pixels. Entradas com o mesmo hash precisam concordar em bytes e dimensões. Alt e label informativos exigem conteúdo além de espaço, tabulação ou quebra de linha e admitem até 1.000 unidades UTF-16. Decorativos exigem texto vazio. As chaves Icon são check, info, warning e close.

O recibo nativo lista IDs declarados como não provisionados. Nesta etapa o diagnóstico indica ausência de resolução, sem verificar a presença física do arquivo. Save As com recursos declarados é recusado. Image e Icon ficam fora da projeção semântica e da renderização até aprovação das etapas seguintes. [Relatório da implementação](../phases/RELATORIO_FASE_01G_B3_A.md).

## Estado da 1G-B3-B

A resolução nativa por ID e revisão lê objetos preexistentes por handles relativos e devolve um snapshot opaco após conferir comprimento, hash e cabeçalho PNG. O Preview continua sem acesso a esses bytes. A validação do cabeçalho não comprova decodificação segura ou canonicalização. Importação, publicação de objetos, quota física, transporte em Salvar como e limpeza de órfãos seguem bloqueados. [Relatório da 1G-B3-B](../phases/RELATORIO_FASE_01G_B3_B.md).
