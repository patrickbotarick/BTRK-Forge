# BTRK Forge — briefing oficial

Fonte: instruções de Fase 0 e complemento GitHub fornecidos pelo responsável do produto em 26/10/2026. Este documento consolida decisões do briefing; o relatório distingue escopo futuro de implementação presente.

## Identidade

BTRK Forge, criado pela BTRK Studio. Categoria: Visual Development Studio / IDE híbrida. Slogan: **Da ideia ao aplicativo.** Idioma principal pt-BR. Direção Digital Foundry: escura, industrial, precisa, modular e profissional.

| Papel | Cor |
|---|---|
| Fundo | `#111820` |
| Painéis | `#1E2933` |
| Bordas estruturais | `#344454` |
| Destaque | `#FF934F` |
| Execução e sucesso | `#49C9B5` |
| Texto principal | `#F0F4F6` |

Inter para interface e JetBrains Mono para código são as fontes propostas. O protótipo usa fontes locais e fallback Segoe UI/Consolas, sem download obrigatório. Nome e identidade aprovados internamente; validação jurídica comercial e licenciamento pendentes. Nenhuma licença open-source foi adicionada.

## Decisões de produto preservadas

- Studio primeiro para Windows; macOS/Linux em versões futuras.
- Aplicações web e Windows desde a primeira versão funcional. Preview de celular é simulação responsiva, sem emulação nativa.
- Projetos locais, capacidades essenciais offline, IA opcional via provedor configurável; nuvem somente no futuro.
- Alternância entre visual e código, correspondência pedagógica entre ambos e mínima necessidade de terminal para o usuário final.
- Modelo próprio independente do renderizador, código gerado derivado desse modelo, extensibilidade por contratos explícitos.
- Versionamento e atualizações independentes do Studio e de cada aplicação gerada.

## Limite da Fase 0

Investigar riscos e produzir protótipos verificáveis. Não implementar IDE completa, marketplace, plugins irrestritos, infraestrutura de nuvem, contas, credenciais, serviços pagos ou publicações de atualização.

Etapas: 0A ambiente; 0B shell; 0C núcleo de grafo; 0D editor Rete; 0E preview e isolamento; 0F exportação web/Windows; 0G segurança e SDK; 0H contratos de IA/atualização; 0I relatório e decisão de continuidade. A aprovação é revisão humana, sem avanço automático à Fase 1.

## Repositório e governança

Repositório oficial: [patrickbotarick/BTRK-Forge](https://github.com/patrickbotarick/BTRK-Forge). Branch principal `main`; desenvolvimento em `codex/phase-00-foundation`. Preservar arquivos e histórico, commits pequenos, nenhum force push, tag ou merge automático. O complemento autoriza publicação da branch da Fase 0 caso haja autenticação; essa instrução específica prevalece sobre a proibição de push automático do briefing inicial.

Documentos obrigatórios: README, briefing, arquitetura, decisões, roadmap, relatório de Fase 0 e validação de QA. Não afirmar testes ou validações que não tenham sido executados.
