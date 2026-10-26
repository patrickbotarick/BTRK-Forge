# Decisões técnicas — Fase 0

Data: 26/10/2026. Status: recomendações para revisão; Fase 1 não autorizada.

| Decisão | Evidência / justificativa | Revisitar quando |
|---|---|---|
| Tauri 2 para o host | Build MSVC/NSIS e smoke WebView2 do Studio e app independente | Preview/processos seguros exigirem capacidades não atendidas |
| React + TypeScript 6.0.3 | Shell, Rete e Monaco executados; TS 7.0.2 consultado, mas fora do peer suportado por typescript-eslint 8.72.1 | Parser suportar TS 7 e migração for testada |
| Rete 2 só apresentação | Arraste, zoom, conexões e restauração testados; runtime sem import de Rete | Escala, acessibilidade ou customização do editor não atenderem |
| Zod 4 + schema próprio | Round trip, migração e rejeições adversariais testados | Formato estabilizar e exigir schema público interoperável |
| Interpretador determinístico | Controle/dados, dois ramos, ações e budgets testados | Funções/loops/async exigirem nova semântica |
| JSON como fonte local | Salvamento/download, abertura e recuperação de rascunho testados | Persistência atômica e múltiplos arquivos da Fase 1 |
| SQLite apenas índice futuro | Não implementado ou medido; não necessário ao contador controlado | Busca/histórico justificarem custo de migração |
| Iframe opaco + Worker | Negação de DOM/storage/bridge, estado e CSP verificados | Código livre, plugins ou capacidades nativas forem habilitados |
| Helper fixo fora do Studio | IPC de validação em processo separado testado | Sandbox real de build e broker Rust concluídos |
| Monaco 0.56.0 + DOMPurify 3.4.17 | Ambas versões 0.56/0.57 traziam versões vulneráveis transitivas; override de patch removeu alertas do npm audit | Nova versão eliminar necessidade do override |
| Sem licença automática | Estratégia comercial ainda não decidida pelo responsável | Decisão jurídica explícita |

## Tauri × Electron

| Critério | Tauri 2 | Electron | Evidência desta fase |
|---|---|---|---|
| Windows | Rust/MSVC + WebView2 do sistema | Node + Chromium distribuídos | Tauri executado; Electron documental |
| Processos auxiliares | Broker Rust/sidecar com escopos; isolamento SO continua necessário | child_process/utilityProcess via main com APIs restritas | Helper Node separado testado; integração host não implementada em nenhum |
| Isolamento | Capabilities, sem plugins/commands, frame sem origem compartilhada | sandbox, contextIsolation, nodeIntegration desativado e IPC mínimo | Tauri/CSP/frame testados; Electron não testado |
| Consumo | Reutiliza WebView2; pacote do Studio ~2,58 MiB | Inclui Chromium/Node; custo de distribuição tende a maior | Tamanho NSIS Tauri medido; sem comparação de RAM/CPU/startup |
| Preview | Frame de origem opaca e worker suficientes para modelo fechado | BrowserView/WebContents oferecem alternativas | Tauri atende contador; código arbitrário não validado |
| Empacotamento | NSIS com toolchain Rust/C++; WebView2 é pré-requisito | Ferramentas de empacotamento JS e runtimes embarcados | Dois pacotes Tauri gerados; sem instalação em VM limpa |
| Atualização | Plugin updater com assinatura de manifestos/pacotes | autoUpdater + assinatura da distribuição | Só documentação/contratos, ambos desativados |
| Manutenção | Rust + frontend + variação WebView2 | JavaScript/Node + atualização do Chromium embutido | Preferência por host mínimo; nenhum benchmark de manutenção |
| Complexidade | ACL e build nativo exigem atenção à CSP | Segurança do preload/main e IPC exige disciplina | CSP do preview recebeu hash explícito; Electron não prototipado |

Não há evidência para afirmar superioridade medida de consumo, segurança absoluta ou compatibilidade de todo tipo de preview. Recomenda-se Tauri para a próxima etapa condicionada aos gates de segurança e persistência.

## Fontes primárias consultadas

- [Tauri — pré-requisitos](https://v2.tauri.app/start/prerequisites/)
- [Tauri — capacidades](https://tauri.app/security/capabilities/)
- [Tauri — CSP](https://v2.tauri.app/security/csp/)
- [Tauri — instalador Windows](https://v2.tauri.app/distribute/windows-installer/)
- [Rete — editor básico](https://retejs.org/docs/guides/basic/)
- [Rete — React](https://retejs.org/docs/guides/renderers/react/)
- [Rete — validação](https://retejs.org/docs/guides/validation/)
- [Electron — sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron — isolamento de contexto](https://www.electronjs.org/docs/latest/tutorial/context-isolation)

Versões reais vêm de `npm view`, `npm ls` e Cargo.lock; não são inferidas de exemplos da documentação.
