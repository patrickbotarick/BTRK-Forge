# Validação da Fase 1G-B3-B2

A suíte experimental Windows passou junto aos seis testes da B1. Depois de ampliar o corpus, o cenário Windows foi repetido com sucesso. Typecheck, lint e scanner estático passaram. O scanner informou 254 arquivos e zero achados no escopo declarado. O build do host e as suítes Rust de persistência ficaram fora da rodada, pois a dependência nova é exclusiva dos testes do spike.

    cargo test --locked --offline --manifest-path tools/image-decoder-spike/Cargo.toml -- --nocapture

| Formato | Fixture 16 × 12 | Pico comprometido do Job | Fixture 4000 × 1999 com verificação | Pico comprometido do Job |
| --- | ---: | ---: | ---: | ---: |
| PNG | 108 ms | 741.376 B | 2.780 ms | 56.885.248 B |
| JPEG | 116 ms | 819.200 B | 3.289 ms | 57.470.976 B |
| WebP | 101 ms | 741.376 B | 3.426 ms | 56.786.944 B |

Medições em debug na rodada direcionada. As fixtures maiores são de cor sólida e altamente compressíveis. A verificação abre o PNG e percorre todos os pixels fora do Job. O pico do Job não inclui o supervisor. O working set não foi medido. Os números não representam o pior caso.

| Gate | Decisão | Evidência ou bloqueio |
| --- | --- | --- |
| Memória | NO-GO | Teto configurado e picos consultados. Faltam alocação crescente, negativa acima do teto e recuperação após excesso ou falha de codificação no processo |
| Tempo | GO COM RESSALVAS | Prazo de 250 ms encerrou o auxiliar bloqueado em stdin e confirmou a saída em 254 ms. Carga contínua, codec lento e saída bloqueada ainda não foram injetados |
| Concorrência | GO COM RESSALVAS | Uma thread recebeu Busy com o slot ocupado. Houve novas chamadas após timeout e erro. O escopo é um processo |
| Filesystem | NO-GO | Token ambiente. Matriz de canários e política de negação ainda pendentes |
| Processos | NO-GO | Saída do auxiliar confirmada. Faltam tentativa de criar descendente, auditoria de handles e encerramento abrupto do supervisor |
| IPC | GO COM RESSALVAS | Quadro truncado retornou código 1, entrada excessiva foi recusada e respostas válidas foram comparadas. Faltam injeções de resposta excessiva, pipe quebrado e saída inesperada |
| Decoder | GO COM RESSALVAS | Três formatos estáticos normalizados sob Job com fixtures pequenas e próximas do limite de pixels. Os malformados da B1 foram cobertos pela regressão, sem repetir todo o corpus hostil dentro do Job |
| Recuperação | GO COM RESSALVAS | Novas chamadas válidas após timeout e erro de protocolo. Excesso real de memória e falha do host seguem pendentes |
