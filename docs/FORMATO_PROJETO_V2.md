# Formato de projeto BTRK v2 — componentes visuais

> Documento histórico da Fase 1B. O contrato corrente está no [formato v3](FORMATO_PROJETO_V3.md), [Blueprint Engine](BLUEPRINT_ENGINE.md) e [limites 1C](LIMITACOES_FASE_01C.md); esta fase histórica permanece preservada.

O schemaVersion 2 generaliza a representação visual da Fase 1A. Substitui `screens[0].button` por `screens[0].components`; não mantém uma cópia concorrente do botão. A tela continua única, com ID e título próprio (cabeçalho da tela). O título da tela é independente dos componentes Text adicionados pelo usuário.

O manifesto canônico continua `project.btrk.json`. Graph, variáveis, funções reservadas, distribuição, permissões e envelope metadata.documentVersion 1 mantêm seus contratos. A versão estrutural identifica o novo formato; não é uma release comercial nem uma mudança da versão do envelope.

## Hierarquia e identidade

Cada componente contém `id`, `type`, `parentId`, `props`, `style` e `events`. A árvore é representada por uma lista ordenada com referência ao pai: parentId null pertence à tela, qualquer outro parentId deve apontar a um Container da mesma tela. A ordem relativa na lista determina a ordem entre irmãos. Não há outra lista children para sincronizar.

- Tipos: Text, Button, Input e Container; somente Container admite filhos.
- IDs globais únicos entre projeto, tela, componentes, variáveis, nodes e conexões; formato anterior mantido.
- Até 200 componentes, contando todos os níveis; profundidade máxima 12, incluindo o componente raiz.
- Pais ausentes, pais folha, autociclos, ciclos desconectados, eventos inválidos e propriedades desconhecidas são recusados.
- Todas as operações de domínio validam uma cópia completa antes de retorná-la; falhas não alteram o documento anterior.
- Duplicar gera novos IDs para a subárvore e remapeia seus parentId internos. Referências a eventos externos do Blueprint permanecem compartilhadas intencionalmente.
- Remover exige confirmação na UI, inclui descendentes e remove os seus vínculos visuais; não apaga nodes/conexões do Blueprint. O grafo não possui referência inversa ao componente removido.

## Propriedades e estilos

Consulte a [matriz de componentes](COMPONENTES_FASE_01B.md). Campos obrigatórios e tipos são definidos em `packages/project-schema/components.ts`; o JSON Schema consumido pelo Rust é derivado de Zod e versionado em `project.schema.json`.

Dimensões: número inteiro de 0 a 2000 em pixels, `auto` ou `fill` (100% do espaço do pai; altura percentual depende de altura definida no pai). O limite de 2000 px é deliberado nesta fase. Não há coordenadas absolutas, CSS livre, breakpoints autorais ou unidades arbitrárias.

Layout usa Flexbox declarativo com direção row/column, gap/padding de 0 a 128 px, alinhamento e justificação allowlisted. Containers permitem wrap. Viewports desktop fluido, web 768 px e celular 375 px renderizam o mesmo documento; celular não é emulação Android. O canvas pode precisar de rolagem conforme sua área disponível.

Cores: hexadecimal de seis dígitos ou `transparent`. Borda: 0–12 px; raio: 0–64 px; fonte: 10–96 px, peso 400/500/600/700 e alinhamento left/center/right. Não são aceitos URLs, HTML, nomes de atributos arbitrários ou trechos de código no estilo.

## Eventos e estado

Button possui events.click igual a null ou ao ID do único node event button.click existente. Vários botões podem disparar esse mesmo evento; não criam novos eventos nem uma linguagem nova. O Preview confere que a origem corresponde a um botão habilitado com vínculo válido antes de pedir execução ao Worker.

Input guarda placeholder, initialValue string, inputType text/email/number e disabled. No Design é selecionável, sem edição direta de seu valor; no Preview usa um input nativo do navegador. Edições do valor no Preview são transitórias e preservadas ao atualizar o estado do runtime dentro da mesma montagem, sem mudar initialValue salvo. Não há binding de dados, evento input/change ou validação de formulário de domínio; as restrições nativas do tipo number/email são as do navegador. Text é literal, sem interpolação de código.

## Migração explícita v0 → v1 → v2

1. Ler bytes sem escrever no arquivo original; v0 conhecida preenche functions e passa a v1 em memória.
2. Validar a estrutura v1 estritamente. O Rust usa o schema congelado `project-v1.schema.json`; o frontend mantém legacyProjectSchema.
3. Substituir o botão único por um componente Button raiz, preservando seu ID, texto, cor e referência ao node de evento existente. Preservar ID da tela, título, projeto, variáveis, nodes, conexões e posições.
4. Validar novamente a estrutura v2 e suas regras semânticas de grafo e componentes. Versões futuras desconhecidas, incluindo documentVersion futuro, são recusadas.
5. Somente Salvar/Salvar como materializa v2 no disco pelo serviço Rust existente. Em um salvamento de v1, o backup anterior mantém os bytes v1 originais.

Nenhum novo ID visual precisa ser inventado na migração do botão único. A primeira interface v2 de um projeto antigo contém o botão original e o título da tela; o usuário pode adicionar sua árvore pelo catálogo. Fixtures v0/v1 não são regeneradas do exemplo novo. `visual-v2.json` é uma fixture atual, e um teste Rust compara sua interpretação com a migração TypeScript do legado equivalente.

Clientes antigos com schema estrito recusam v2. Não há downgrade ou promessa de round trip para um Studio anterior. O projeto continua limitado a 2 MB na fronteira nativa e de escrita.

## Histórico e persistência

O histórico contém até 100 snapshots de transações válidas, somente em memória. Cada evento de edição do Inspector constitui uma transação; seleção e viewport não entram no histórico. Undo/redo restaura o documento e preserva o envelope metadata atual para não criar diferenças artificiais após salvar.

Salvar conserva o histórico quando o conteúdo é equivalente, independentemente da ordem dos campos JSON retornada pelo Rust. Abrir/criar/importar ou adotar conteúdo diferente descarta o histórico anterior. Reiniciar o Studio também o descarta; o histórico não faz parte do manifesto. Uma edição nova depois de undo limpa o redo.

Workspace, sessões, hashes de revisão dos bytes, backups, recuperação, ACL e escrita atômica continuam sob as [garantias da Fase 1A](ARQUITETURA_V0_2.md). Não foram enfraquecidos para suportar o novo formato.
