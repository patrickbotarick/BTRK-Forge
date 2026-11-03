# Fase 1G-B2 — dimensionamento no contrato v3

**Entrega restrita, candidata a GO COM RESSALVAS.** O Designer permite aplicar largura e altura pelo Inspector em seleção única ou múltipla. O campo mostra valores mistos e mantém o rascunho local até confirmação por botão ou Enter. A alteração em lote valida a cópia pelo domínio e entra no histórico como uma única transação. Trocar de viewport altera somente a sessão visual e a escolha acompanha a navegação entre Designer e Preview.

## Contrato adotado

| Valor | Comportamento |
|---|---|
| auto | Dimensionamento automático do navegador segundo conteúdo e contexto Flex. |
| fill | 100% da dimensão do bloco que contém o componente. Em altura, a resolução percentual depende de altura definida no bloco pai. |
| 0–2000 | Pixels inteiros. O renderizador existente usa border-box e limita a largura à do pai. Valores negativos, fracionários, fora da faixa ou sem unidade reconhecida são recusados. |
| Container | Flex com wrap, direção em linha/coluna, alinhamento e distribuição existentes, gap e padding de 0 a 128 px. O navegador aplica suas regras de encolhimento e quebra. |

Designer e Preview usam o mesmo renderizador declarativo. A decoração e a área disponível de cada superfície podem produzir medidas externas diferentes. Os presets 375 px, 768 px e desktop fluido continuam limitados ao espaço disponível na interface. As dimensões são próprias de cada componente, sem herança adicional. Projetos antigos mantêm valores e padrões das migrações existentes. Campos obrigatórios ausentes em um v3 inválido continuam sujeitos à validação.

## Gate de formato

O schema final continua **v3**, sem migração nova. O JSON Schema consumido pelo Rust e o contrato TypeScript permanecem intactos. Grid, percentuais livres, min/max por componente e expansão Flex configurável exigiriam novos campos e validação equivalente antes da persistência. Esses itens ficam bloqueados nesta entrega. Alças de dimensionamento, breakpoints arbitrários e posicionamento absoluto ficam fora da fatia. Nenhum CSS livre, URL, HTML ou script entra no documento.

A [validação](../qa/VALIDACAO_FASE_01G_B2.md) separa Chromium, UI/Rust e Tauri. Os quatro componentes, IR v1, Blueprint, TypeScript gerado, eventos, bindings e Preview isolado conservam seus contratos. A homologação Tauri da 1G-A e 1G-B1, a homologação integral Windows da 1D e as ressalvas históricas seguem abertas. A 1E-A continua suspensa, a 1E-B em NO-GO e a 1F sem início. A 1G-B3 aguarda autorização.

## Revisão de alvos em lote

A reprodução na base 7edb059 confirmou largura de 300 px no Container e no Text. Altura e alinhamento também alcançavam os descendentes selecionados. O domínio já percorria todos os IDs explícitos para propriedades, mas calculava as raízes antes de decidir o tipo de operação.

A revisão separa as duas rotas. Largura, altura e alinhamento validam IDs explícitos, recusam seleção vazia, duplicada ou inexistente e aplicam a propriedade uma vez por componente em uma cópia validada. Duplicação, remoção, movimento e reordenação continuam usando raízes de subárvore. A publicação e o histórico continuam atômicos. O schema v3 e o escopo de layout permanecem os mesmos.
