# Matriz de capacidades e limitações — Fase 1C

| Área | Capacidade exercitada | Limite preservado |
|---|---|---|
| Design | Text/Button/Input/Container, árvore, Inspector, navegação ao Blueprint | Uma tela, quatro tipos, sem seleção múltipla, layout por containers |
| Input | Valor atual string, binding explícito string, onChange por ID | number/email não fazem conversão automática; sem validação de formulário |
| Text | Leitura e atualização transitória pelo Worker | Sem HTML, expressão embutida ou CSS livre |
| Blueprint | 11 tipos semânticos, 13 entradas no catálogo; pesquisa, parâmetros, conexões, posições, zoom/pan | DAG limitado; sem funções, loops, catálogo externo ou plugins |
| Histórico | Design e lógica no mesmo histórico validado | 100 transações em memória; arraste não é agrupado; sem undo entre sessões |
| Variáveis | Criar number/string/boolean, ler/escrever, editar initial | Sem exclusão, renomeação ou mudança de tipo existente pela UI |
| Eventos | onClick e onChange, FIFO limitada, IDs estáveis | Um vínculo ativo por tipo/componente; sem eventos Container/Text |
| Debug | Trilha, nodes avaliados, variáveis, erro/node, reset/interrupção | Sem breakpoint, passo a passo ou debugger Rust |
| Código | Modelo JSON validado existente | TypeScript derivado adiado; sem edição livre bidirecional |
| Exportação | Contador histórico continua passando em produção | Exportação generalizada de projetos visuais não implementada |
| Windows | Release/NSIS gerados e janela release exercitada | Sem assinatura/release comercial ou instalação em máquina limpa |
| Acessibilidade | Controles rotulados, alternativa por formulário/lista | Sem homologação completa com leitor de tela; escala/DPI não exaustivos |

O binding deixou de ser indisponível somente no escopo string explicitamente testado nesta fase. Isso não altera retroativamente a homologação limitada da Fase 1B.

## Cinco ressalvas herdadas, abertas

1. Durabilidade física sob falha de energia não homologada.
2. Janela residual de corrida em alteração externa; não há CAS de kernel.
3. Auditoria RustSec pendente; nenhuma ferramenta adicional foi instalada nesta execução.
4. Instalação/desinstalação em máquina limpa pendente.
5. Mensagem WebView2 observada no encerramento nas fases anteriores; não foi demonstrada correção.

Persistem também matriz exaustiva de filesystems/DPI, disco cheio físico, retenção cronológica de snapshots, assinatura/licença/distribuição, sandbox de código de terceiros e evolução de IA/atualizações. IA, plugins e atualizações não foram habilitados. A Fase 1D não foi iniciada.
