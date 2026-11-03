# Fase 1G-B3-A — fundação persistente v4

## Dependências identificadas antes da implementação

O schema Zod é consumido pelo Designer e pelo motor, e o JSON Schema gerado é validado pelo Rust. A fábrica e a biblioteca atuais só devem inserir os quatro tipos históricos. O renderizador compartilhado e a fonte embutida no Preview não podem transformar Image/Icon em conteúdo nesta fase. A sessão Rust controla manifesto e backup, e Save As não possui transporte de objetos externos. A IR v1 e a validação do gerador usam schemaVersion 3 no envelope semântico. Esse valor deve permanecer estável para a mesma semântica executável, inclusive revisão e mapas de origem. A persistência v4 precisa validar os componentes inertes antes de excluí-los dessa projeção.

## Implementação

O formato corrente passa a v4, com Image e Icon como folhas de eventos vazios e resources raster declarados. Panel conserva a representação Container e o catálogo atual continua oferecendo os quatro tipos históricos. A migração valida as formas históricas com os schemas congelados e normaliza em cópia para v4. O original fica no disco até Salvar, que preserva o backup conforme o contrato anterior.

Image exige referência lógica válida e alt informativo ou vazio quando decorativo. Icon aceita somente check, info, warning e close, com a mesma regra para label. Ambos são preservados no documento e ignorados pelo renderizador até a etapa visual. O Rust informa IDs não provisionados no recibo sem abrir arquivos de assets. Save As aceita manifestos sem recursos. Com recursos declarados, recusa antes de criar a pasta de destino, pois a cópia física pertence à próxima etapa.

O envelope da IR v1 continua descrevendo o subconjunto semântico v3. O lowering valida o documento completo e exclui somente Image e Icon da lista semântica. Os 11 nodes, as entradas de evento, os bindings, a ordem, os diagnósticos e os IDs de origem conservam seus contratos. A comparação v3/v4 cobre IR, código, revisão SHA-256 e intervalos de origem. O harness compila e executa TypeScript com mídia declarada e verifica estado, trace, eventos, bindings e rollback.

A [validação](../qa/VALIDACAO_FASE_01G_B3_A.md) registra a matriz e a regressão. Permanecem pendentes os bytes físicos, a quota física, importação, renderização e homologação Tauri. A 1G-B3-B aguarda autorização. A 1E-A segue suspensa, 1E-B em NO-GO e 1F sem início. Continuam abertas as homologações Tauri de 1G-A, 1G-B1 e 1G-B2, a homologação integral Windows da 1D e as ressalvas históricas de energia, corrida sem CAS, RustSec, instalação limpa, WebView2, segurança, sandbox e distribuição.
