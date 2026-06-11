# Twitch Lurker Extension — MVP Design

**Data:** 2026-06-10
**Status:** Aprovado (aguardando revisão do spec)

## Resumo

Extensão de Chrome (Manifest V3) que autentica o usuário na Twitch, lista os
canais que ele segue, e roda um "lurking" pessoal: o usuário escolhe canais e a
extensão abre 2 streams por vez num grupo de abas, rotacionando por tempo
configurável. Inclui uma aba de descoberta com lives populares vindas da própria
API da Twitch.

É uma ferramenta de **lurking pessoal** — um humano real acompanhando canais que
ele escolheu. Não é, e não será, um sistema de inflar audiência de terceiros.

## Linha ética (escopo fixo)

O que torna isso lurking legítimo (tolerado pela Twitch) e não viewbotting:

- **A decisão do que entra na rotação é do usuário e é local.** A extensão nunca
  recebe de um servidor uma lista de "canais pra rotacionar".
- **As sugestões são descoberta pura** via `/helix/streams` (lives populares da
  Twitch). O usuário navega e escolhe. Nada curado nem direcionado por servidor.
- **Áudio:** o mute é no nível da aba do Chrome (o usuário não ouve). O player
  da Twitch permanece com volume alto para a live continuar contando como viewer.
- **Ciclo de sincronização:** a cada N minutos (ou 5 min quando rotação = ∞)
  a extensão verifica quem ainda está ao vivo na lista do usuário, fecha abas
  em raid sem substituto e rotaciona só quando há mais canais ao vivo do que abas.

Fora de escopo permanente: venda de viewers, direcionamento de audiência por
servidor, simulação de chat.

## Arquitetura

Tudo client-side. **Sem backend e sem banco de dados no MVP.**

### 1. Autenticação (Twitch OAuth)

- `chrome.identity.launchWebAuthFlow` com OAuth da Twitch, **implicit grant**
  (sem client secret, adequado a cliente público).
- Scope: `user:read:follows`.
- Redirect URI: o gerado por `chrome.identity.getRedirectURL()`.
- Token salvo em `chrome.storage.local`. Implicit grant não dá refresh token;
  ao expirar (ou em 401), dispara re-autenticação.
- Client-Id da aplicação Twitch fica embutido na extensão (é público por design).

### 2. Acesso a dados (Helix API)

Todas as chamadas com headers `Client-Id` + `Authorization: Bearer <token>`.

- `GET /helix/users` → resolve o `user_id` do usuário logado.
- `GET /helix/streams/followed?user_id=<id>` → follows que estão **ao vivo agora**
  (nome do canal, jogo, viewers, thumbnail).

### 3. Popup (ação rápida)

- Lista dos follows ao vivo, cada um com toggle "incluir na rotação".
- Botão **Play / Pause** da rotação.
- Status atual: canais em exibição + contagem regressiva pra próxima troca.
- Link/atalho pra página de opções.

### 4. Página de Opções

- **Tempo de rotação** (default 10 min).
- **Nº de abas simultâneas** (default 2).
- **Áudio**: mutado (default) ou com som — mute normal do navegador.

### 5. Service Worker (background)

- Gerencia o estado da rotação (canais selecionados, índice atual, play/pause).
- Cria um **grupo de abas** "Rotacionando" com as abas de stream.
- `chrome.alarms` agenda a troca a cada N minutos: substitui as URLs das abas
  pelos próximos canais da lista (round-robin), pulando os que saíram do ar.
- **Pause**: cancela o alarme e para de mexer nas URLs. **Play**: retoma.
- Ao parar a rotação (botão Parar, distinto do Pause), fecha o grupo de abas
  "Rotacionando". Pause apenas congela e mantém as abas abertas.

### 6. Storage (`chrome.storage.local`)

- `auth`: token + expiração + user_id.
- `rotation`: lista de canais selecionados, índice atual, estado play/pause.
- `settings`: intervalo, nº de abas, preferência de áudio.

## Componentes e limites

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `auth` | OAuth, guardar/renovar token | chrome.identity, storage |
| `twitchApi` | Wrapper das chamadas Helix | auth (token), Client-Id |
| `rotation` (SW) | Estado + ciclo de troca de abas | twitchApi, tabs, tabGroups, alarms, storage |
| `popup` | UI de ação rápida | twitchApi, rotation (mensagens) |
| `options` | UI de configurações | storage |

Comunicação UI ↔ background via `chrome.runtime.sendMessage`.

## Fluxo principal

1. Usuário instala, abre o popup, clica "Conectar com a Twitch" → OAuth.
2. Popup carrega follows ao vivo via `streams/followed`.
3. Usuário marca alguns canais e clica **Play**.
4. Service worker cria o grupo "Rotacionando", abre os 2 primeiros canais.
5. A cada N min, o alarme troca as abas pelos próximos canais (round-robin).
6. **Pause** congela; **Play** retoma. Parar fecha o grupo.

## Tratamento de erros

- Token expirado / 401 → re-autenticar.
- Rate limit (429) → backoff e reusar último resultado em cache.
- Canal selecionado saiu do ar → pular na rotação.
- Sem follows ao vivo → estado vazio orientando a voltar quando houver lives.

## Testes

- `twitchApi`: testar parsing/erros com respostas mockadas.
- `rotation`: lógica de round-robin, skip de offline, play/pause (lógica pura
  separada das chamadas de `chrome.tabs`).
- Smoke manual: fluxo de OAuth e rotação real no navegador.

## Fora do MVP

- Backend / banco de dados.
- Aba de descoberta (lives populares) e filtro de idioma.
- Sugestões curadas ou direcionadas por servidor.
- YouTube, TikTok, Kick.
- Simulação de chat (contra os termos — não será implementado).
