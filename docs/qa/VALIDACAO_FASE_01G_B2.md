# Validação da Fase 1G-B2

| Verificação | Resultado |
|---|---|
| Typecheck e lint | Aprovados |
| TypeScript, incluindo edição de dimensão em lote | 141 aprovados |
| E2E Chromium | 31 aprovados na rodada final |
| UI com driver Rust | 14 cenários aprovados ao todo, 13 na regressão e o novo cenário após corrigir o rótulo acessível |
| Rust persistência | 26 aprovados |
| Produção Chromium e CSP | 5 aprovados |
| Build web e scanner estático | Aprovados, com aviso de tamanho de chunks no Vite |

A primeira tentativa das suítes de navegador encontrou o Chromium ausente. O navegador fixado pelo Playwright foi provisionado em artefatos locais e a execução foi reiniciada. O novo cenário UI/Rust também encontrou um rótulo implícito ambíguo no seletor de unidade. O nome acessível explícito corrigiu a falha. Os resultados contam casos únicos.

O teste de domínio verifica rejeição de dimensão inválida, serialização v3 e preservação do grafo. O cenário web exercita teclado, valores mistos, recusa sem alteração, confirmação atômica, undo/redo e o mesmo valor declarativo no Designer e no Preview em 375 px, 768 px e desktop. O teste UI/Rust usa o filesystem real para salvar e reabrir a largura relativa. A regressão inclui migrações históricas, eventos, bindings, Preview isolado e Codegen.

- [Designer no Chromium](evidencias/fase01g-b2/design-mobile.png)
- [Preview no Chromium](evidencias/fase01g-b2/preview-mobile.png)

A comparação visual usa a mesma configuração de largura e o mesmo valor de estilo do componente. O entorno da tela e as margens podem diferir. A execução UI/Rust usa navegador com driver Rust. A validação funcional no Tauri real segue pendente.

## Revisão pontual de alvos em lote

O teste de reprodução passou antes da alteração. Pai e filho já recebiam largura de 300 px, e o cenário ampliado confirmou largura, altura e alinhamento em pai, filho e neto. A revisão tornou explícita a separação entre seleção integral para propriedades e raízes para operações estruturais.

Nova execução: typecheck e lint aprovados, 142 testes TypeScript e 32 E2E Chromium aprovados, além de um cenário direcionado UI/Rust aprovado com salvamento e reabertura de pai e filho. O cenário Chromium verificou valores mistos, aplicação, undo/redo e recarga. O domínio verificou seleção vazia, repetida ou inexistente, recusa sem mutação e serialização v3. As suítes Rust e de produção permanecem como evidência anterior. A homologação Tauri continua pendente.
