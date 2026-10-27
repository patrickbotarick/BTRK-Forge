# Blueprint Engine — Fase 1C

## Documento e superfícies

O modelo em `project-schema` é a única fonte persistente. Design e Blueprint editam esse mesmo documento por comandos validados em cópias; Rete é uma projeção descartável. O runtime usa outro objeto transitório, nunca grava os valores digitados, variáveis mutadas, textos renderizados ou trilhas no manifesto. O botão Salvar persiste somente a definição.

Design seleciona e configura componentes; não dispara eventos de aplicação. Preview renderiza controles reais em iframe sandbox de origem opaca e envia eventos estruturados pelo MessagePort privado. O Studio valida o evento e o projeto antes de enviá-los ao Worker. O aplicativo exportado histórico continua restrito ao contador da Fase 0: executar o Preview 1C não equivale a exportar projetos visuais v3.

## Eventos por identidade

- `button.click`: mensagem `{type, componentId}`; Button habilitado, vínculo `events.click`, ID estável. O node novo registra `componentId`. Somente o legado pode omiti-lo, preservando seu evento compartilhado.
- `input.change`: mensagem `{type, componentId, value}`; Input habilitado, string até 1000 caracteres. O valor atual é ingerido antes das ações e sincronizado com seu binding. `events.change` pode ser null: o Input ainda fornece seu valor atual ao fluxo de clique. Node de onChange exige ID do Input.
- Uma associação de evento ativa por componente/tipo; criar ou atribuir outro evento substitui essa associação, preservando o node anterior. De 1 a 32 nodes de evento por documento. Eventos sem associação permanecem no grafo sem disparo automático.
- Container não tem evento próprio. Text pode ser lido e atualizado por ações permitidas, sem evento nesta fase.

## Catálogo implementado

| Node / parâmetro | Entradas | Saídas | Comportamento |
|---|---|---|---|
| event / tipo, componentId | — | next: exec | Inicia o fluxo associado ao componente; legado global button.click preservado |
| constant / value | — | value: tipo do valor | Literais string, number finito ou boolean |
| variable / variableId | — | value: tipo da variável | Lê o estado runtime atual |
| set / variableId | in: exec, value: tipo da variável | next: exec | Atribui e sincroniza Inputs ligados à variável string |
| component-value / componentId, property | — | value: string | Lê Input.value ou Text.text transitório |
| set-text / componentId | in: exec, value: string | next: exec | Atualiza Text.text transitório |
| add | a,b: number | value: number | Soma finita |
| greater | a,b: number | value: boolean | Comparação a > b |
| empty | value: string | value: boolean | Vazio após trim; espaços em branco contam como vazio |
| concat | a,b: string | value: string | Concatenação, sem interpolação ou execução de código |
| condition | in: exec, test: boolean | yes,no: exec | Segue exatamente um ramo |

As três entradas de constante no catálogo são o mesmo tipo de node com valores tipados. O catálogo possui pesquisa, seleção pelo canvas/lista, parâmetros, referência por ID, navegação ao Design, remoção confirmada e conexões/desconexões pela forma ou por gestos Rete. Portas: branco exec, verde number, roxo string, amarelo boolean. Zoom, pan e enquadramento permanecem; posições são persistentes. Nodes incompletos aparecem em vermelho e impedem execução, mas podem ser salvos como rascunho válido.

## Binding e estado

Variáveis possuem ID, nome, tipo number/string/boolean e initial persistente. O editor cria variáveis dos três tipos e edita seu valor inicial. Não há exclusão/renomeação/mudança de tipo de variável existente pela UI nesta fase.

Input possui `props.binding`: null ou ID de variável string. Sem binding, initialValue define o estado inicial do Input. Com binding, a variável é a fonte: seu initial prevalece sobre initialValue. Digitar atualiza variável e todos os Inputs ligados a ela; set da variável faz a mesma sincronização. Isso não gera novos eventos recursivos. Input number/email continua fornecendo string; não há coerção numérica automática ou validação de formulário de domínio.

Runtime: `{variables: Record<id, scalar>, properties: Record<componentId, string>}`. Properties inclui somente Input e Text. O Worker exige exatamente as chaves do documento, tipos corretos e coerência do binding. Alterações do modelo, abertura de uma sessão nativa, Reiniciar estado, Interromper execução ou timeout recriam o Worker e reiniciam o runtime. Salvar sem alterar o modelo preserva o runtime. Fechar/reabrir reinicia mesmo quando o documento tem o mesmo conteúdo.

## Ordem e limites

Eventos aceitos entram numa fila FIFO, um pedido por vez, até 32 eventos aguardando; excesso é recusado com mensagem. Pedidos têm IDs monotônicos; respostas atrasadas/incompatíveis não são aplicadas. Cada fluxo recebe o estado do evento anterior. Renderização é consolidada quando a fila esvazia, evitando aplicar respostas intermediárias durante digitação pendente.

O controle segue next ou o ramo escolhido. Dados são avaliados sob demanda, na ordem das entradas usadas, com leitura do estado vigente. Não há cache de expressões entre ações: um set anterior é visível às leituras seguintes. Mesmo estado e evento produzem mesma trilha. Somente uma entrada por porta e uma conexão por saída exec; dados podem ter vários consumidores. Ciclos são proibidos, inclusive desconectados.

Orçamento: 10000 visitas de controle/avaliação por evento; até 200 nodes e 500 conexões; 100 variáveis; 1000 caracteres por string; 2 MB por documento e 3 milhões de caracteres por mensagem Worker. Timeout de 2 segundos termina o Worker e reinicia fila/estado. Sem loops irrestritos, funções arbitrárias, eval, imports, comandos de sistema ou plugins.

Cada ação executa numa cópia. Falha descarta mutações de ações daquele evento, retornando runtime anterior às ações, trilha parcial, mensagem e node responsável. Ingestão de Input precede a transação das ações e pode permanecer após falha de ação. Documento incompleto é recusado antes de ingerir o Input. Erros estruturais podem não ter um node de origem; erros de entrada incompleta e avaliação identificam o node.

## Histórico e referências

Design e Blueprint compartilham o histórico de documentos completos, limitado a 100 transações. Comandos de adição/configuração/conexão/desconexão/remoção e movimentos são reversíveis. Nova edição limpa o futuro. Undo/redo valida documentos e não restaura referências inválidas silenciosamente. O histórico não é persistente; arraste pode consumir várias transações, uma por atualização de posição.

Duplicar componentes preserva a referência ao evento global legado, desliga eventos escopados à identidade original e mantém o binding de variável string compartilhado. Não copia grafos implicitamente. Remover componente referenciado por qualquer node é recusado; primeiro remova/redirecione esses nodes explicitamente. A remoção confirmada de node remove suas conexões incidentes e desliga as associações de evento daquele node. Não remove componentes nem outros nodes. O último evento não pode ser removido.

## Depuração e segurança

Iniciar executa o Button habilitado selecionado no Design ou o primeiro Button associado. Preview dispara o controle real. Console mostra evento e componente, trilha de controle, variáveis, erros e botão para localizar node da falha. O canvas destaca também nodes de dados avaliados e nodes incompletos. Reiniciar estado e interromper recriam a execução. Não há breakpoint, pause/step real, inspeção Rust ou memória completa.

MessagePort restrito, validação estrita do evento/pedido/resposta, iframe `sandbox=allow-scripts`, origem opaca, CSP, renderizador fixo gerado e textContent preservados. Nenhuma bridge Tauri é exposta ao iframe/Worker. O hash CSP foi regenerado após alterar o renderizador e exercitado em produção. Os projetos continuam declarativos; este Worker não é uma sandbox para código arbitrário.

## Decisão sobre TypeScript derivado

A investigação identificou que uma tradução fiel precisa incluir fila de eventos, ingestão/binding, transações com rollback, avaliação sob demanda, limites e cancelamento. Gerar apenas chamadas lineares esconderia diferenças de comportamento. Foi adiada a geração TypeScript e o mapa trecho/node para a futura integração de código, com testes de equivalência como condição. Nenhuma tela é anunciada como código gerado. A aba Modelo JSON continua sendo a ferramenta avançada de edição validada existente; o fluxo normal demonstrado não a utiliza. Não há round trip livre código/Blueprint.

Veja [schema v3](FORMATO_PROJETO_V3.md), [limites atuais](LIMITACOES_FASE_01C.md) e [validação](qa/VALIDACAO_FASE_01C.md).
