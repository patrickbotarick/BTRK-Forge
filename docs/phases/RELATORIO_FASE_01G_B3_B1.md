# Fase 1G-B3-B1 — Prova experimental de normalização

**Decisão: NO-GO para publicação segura de assets.**

A prova fica em [tools/image-decoder-spike](../../tools/image-decoder-spike/Cargo.toml). O crate independente seleciona PNG, JPEG e WebP estático por assinatura. Usa image 0.25.10 com apenas os três codecs habilitados, implementados em Rust por png 0.18.1, zune-jpeg 0.5.15 e image-webp 0.2.4. O lockfile fixa a árvore, sem dependência de codecs nativos instalados no Windows. O crate também usa crc32fast 1.5.3 e sha2 0.10.9. A escolha privilegia uma API comum e manutenção pública. Codecs individuais dariam acesso mais direto aos limites de cada parser, ao custo de três integrações e políticas separadas. Uma API de imagem do Windows acrescentaria dependência do ambiente e exigiria qualificar os codecs instalados. O histórico de avisos de toda a árvore ainda precisa de auditoria. [Código e publicação do image](https://docs.rs/crate/image/0.25.10) · [Semântica dos limites da biblioteca](https://docs.rs/image/0.25.10/image/struct.Limits.html)

O auxiliar experimental lê um quadro por stdin, com comprimento u32 little-endian, bytes da imagem e EOF obrigatório. Só em sucesso grava um quadro equivalente de PNG em stdout. O processo recebe bytes, sem caminho de projeto no protocolo. O código não abre arquivos, mas o token do processo continua com suas permissões ambientes. Portanto, a ausência de escrita sob comprometimento ainda precisa ser demonstrada.

| Controle | Valor e estado |
| --- | --- |
| Entrada e saída | 8 MiB cada, verificadas no quadro e no escritor |
| Dimensões | 4096 por eixo, 8 milhões de pixels |
| Metadados | 64 KiB acumulados nos segmentos inspecionados. PNG com chunks de metadados potencialmente comprimidos ou perfil ICC é recusado preventivamente |
| Alocação do codec | 96 MiB solicitados à biblioteca. Limite consultivo, sem teto comprovado de processo |
| Tempo | Encerramento por chamada do host de teste demonstrado com espera de 100 ms. Supervisor automático pendente |
| Concorrência | Um quadro por processo. Limite global pendente |
| Quotas v4 | 64 recursos e 64 MiB por projeto continuam no contrato persistente. O auxiliar opera sobre uma imagem e não altera o manifesto |

O normalizador gera RGBA8 em PNG, verifica estrutura e CRC e calcula SHA-256 sobre a saída. As fixtures foram decodificadas novamente e a repetição foi estável na versão e configuração ensaiadas. A identidade futura deve usar os bytes finais, com versão do normalizador registrada e sem presumir hashes idênticos entre versões.

O menor próximo incremento é um supervisor Windows que lance um binário fixado com token e ACLs restritivos e Job Object antes de liberar a entrada. Deve falhar fechado se a atribuição falhar, impor um slot, limite de memória comprometida, prazo e saída, e destruir a árvore após falha. Validar o limite com excesso de alocação real, o prazo com carga que não coopere e a fronteira do workspace com tentativas de escrita em canários sintéticos. Se o ambiente local impedir essa prova, repetir em laboratório descartável. [Limites de Job Objects no Windows](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information)

Os resultados e gates estão na [validação](../qa/VALIDACAO_FASE_01G_B3_B1.md). Importação para usuários, gravação em assets/sha256, alteração de manifesto, Save As e integração com Tauri continuam fora desta prova. A 1G-B3-C segue sem início. O resolver somente leitura, as homologações pendentes e as ressalvas históricas permanecem conforme o [relatório anterior](RELATORIO_FASE_01G_B3_B.md).
