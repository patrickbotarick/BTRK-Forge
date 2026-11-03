# Validação da Fase 1G-B3-B1

No Windows, seis testes Rust passaram, sem falhas ou ignorados. Comando reproduzível:

    cargo test --locked --offline --manifest-path tools/image-decoder-spike/Cargo.toml -- --nocapture

As três fixtures estáticas vieram de Canvas Chromium, com 16 × 12 pixels e cor sólida #20a040. Os testes usam tolerância de cinco níveis por canal para as perdas de JPEG e WebP. O ensaio usa arquivos sintéticos e não abre projetos.

| Ensaio | Resultado |
| --- | --- |
| PNG, JPEG e WebP estáticos | Normalização, SHA-256, reabertura, dimensões, cor e repetição aprovados |
| Truncamento dos três formatos, assinatura falsa, CRC PNG, tamanho RIFF, bytes anexados | Rejeições confirmadas |
| Eixo excessivo, metadados grandes, chunks APNG e marcador WebP animado | Rejeições confirmadas. O caso WebP usa marcador sintético em RIFF estático, sem corpus de animações completas |
| Entrada excessiva e escritor PNG cheio | Rejeições confirmadas. O teste do escritor injeta excesso diretamente, sem uma imagem completa cujo PNG supere 8 MiB |
| Protocolo vazio, truncado ou com byte extra | Processo retorna falha sem saída. Uma nova instância aceita o quadro válido |
| Processo bloqueado aguardando quadro | Encerramento forçado e coleta do status de saída. A chamada de encerramento e a espera completaram em 101 ms desde o início de uma espera deliberada de 100 ms |
| Prazo automático, memória comprometida, concorrência global e tentativa ativa de escrita | Pendentes. Ainda não há contenção demonstrada por sistema operacional |

Medição única em debug, com as fixtures pequenas. Não representa pior caso ou orçamento de produção.

| Formato | Normalização no teste | Tamanho final | Processo medido separadamente |
| --- | ---: | ---: | ---: |
| PNG | 1.003 µs | 157 B | 29 ms |
| JPEG | 659 µs | 157 B | 6 ms |
| WebP | 507 µs | 164 B | 6 ms |

A consulta de pico pelo objeto de processo após a saída não retornou valor. Pico e teto de memória permanecem sem comprovação. O teste de bloqueio exercita a comunicação, sem reproduzir travamento dentro de codec. A falha no escritor não demonstra recuperação após OOM. A ausência de chamadas de escrita em disco no código não substitui o teste de negação pelo sistema.

Typecheck, lint e scanner estático do repositório passaram. O scanner informou 251 arquivos e zero achados no escopo declarado. O crate novo foi compilado nos testes. As suítes Rust da persistência e o build do host ficaram fora desta rodada porque o crate é independente e não altera seus contratos nem suas dependências.
