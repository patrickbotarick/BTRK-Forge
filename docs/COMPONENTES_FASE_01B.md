# Matriz de componentes e edição — Fase 1B

| Tipo | Propriedades implementadas | Filhos / comportamento |
|---|---|---|
| Text | Texto literal até 1000 caracteres; estilo comum | Sem filhos; conteúdo por textContent |
| Button | Texto até 100; disabled; events.click null ou node de evento existente | Sem filhos; no Preview dispara somente button.click suportado |
| Input | Placeholder até 100; initialValue até 1000; text/email/number; disabled | Sem filhos; valor transitório no Preview; binding/eventos indisponíveis |
| Container | column/row; gap; padding; stretch/flex-start/center/flex-end; justificação flex-start/center/flex-end/space-between | Admite filhos e aninhamento até o limite; wrap responsivo |

Estilo comum: largura/altura auto, fill ou pixels; fundo, cor e borda; espessura e raio de borda; tamanho/peso de fonte e alinhamento de texto. Limites e unidades no [formato v2](FORMATO_PROJETO_V2.md).

## Operações reais

- Catálogo por botões ou arraste para o canvas. A inserção usa o Container selecionado, ou o pai do elemento selecionado; selecionar a tela insere na raiz. O drop não infere outro pai pela coordenada do cursor.
- Seleção pelo canvas ou árvore. Canvas aceita foco e Enter/Espaço; a árvore usa botões com estado pressionado.
- Inspector tipado, com rejeição e mensagem em português em caso de valor/operação inválida. A interface oferece somente eventos implementados.
- Subir/Descer reordenam irmãos; Mover para transfere para um Container ou raiz. Descendentes aparecem no seletor, mas ciclos são recusados sem alteração parcial.
- Duplicar copia a subárvore com novas identidades. Remover exige confirmação, informa preservação do Blueprint e inclui descendentes.
- Desfazer/Refazer com até 100 transações. Ctrl+Z, Ctrl+Shift+Z/Ctrl+Y fora de campos editáveis; Delete pede remoção do selecionado; Ctrl+S salva pelo serviço nativo ou exporta JSON no laboratório web. Dentro de campos, a edição de texto mantém atalhos nativos do controle.
- Painéis com rolagem, seleção/foco visíveis e viewports compartilhados com o Preview. Não há redimensionamento interativo dos painéis nesta versão.

Canvas é uma superfície de seleção: controles de formulário não executam eventos nele. Preview usa os componentes reais e o mesmo renderizador, em iframe isolado. Não há drag de posição absoluta, seleção múltipla, teclado de navegação por setas da árvore, undo persistente, catálogo externo, assets, estilos livres, responsividade por breakpoint ou edição bidirecional de código. Esses recursos não são botões simulados.
