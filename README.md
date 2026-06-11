# Support My Streamers

Extensão de Chrome que autentica na Twitch, lista os streamers que você segue
que estão **ao vivo** e roda um "lurking" pessoal: você escolhe canais e a
extensão abre 2 por vez num grupo de abas, rotacionando a cada N minutos.

É uma ferramenta de lurking pessoal — um humano real acompanhando canais que ele
escolheu. Não inflama audiência de terceiros, não direciona viewers por servidor
e não simula chat.

**AI assistants:** read [AGENTS.md](AGENTS.md) ([agents.md](https://agents.md/) format) and [coding standards](.cursor/rules/coding-standards.mdc). **Code in English**; UI copy in `src/i18n.js` only.

## Estrutura

```
manifest.json          Manifest V3
src/
  config.js            Constantes (sem segredos)
  rotation.js          Lógica pura da rotação (round-robin)
  twitchApi.js         Wrapper da API Helix
  auth.js              OAuth da Twitch (implicit grant)
  storage.js           Wrappers de chrome.storage.local
  background.js        Service worker (orquestra tudo)
  twitchPlayer.js      Content script (volume, overlays na Twitch)
  popup/               UI de ação rápida (play/pause/seleção)
  options/             Configurações + Client-ID
test/                  Testes (Vitest) da lógica pura
AGENTS.md              Instruções para IAs (arquitetura, invariantes)
how-it-works.md        Tab cycle, audio, raid rules (English)
```

## Behavior

Sync cycle, offline/raid rules, audio, and player details:
[how-it-works.md](how-it-works.md).

## Setup do desenvolvedor (uma vez, só você)

O usuário final NÃO faz nada disso — ele só clica em "Conectar com a Twitch".
Estes passos são pra você, dono do projeto, deixar a extensão pronta.

### 1. Criar UM app na Twitch (o app do projeto)

1. Acesse <https://dev.twitch.tv/console/apps> → **Register Your Application**.
2. **Name**: "Support My Streamers".
3. **Category**: Application Integration.
4. **OAuth Redirect URLs**: você preenche no passo 3.
5. Salve e copie o **Client ID**.

### 2. Embutir o Client-ID

Cole o Client-ID copiado em `src/config.js`:

```js
export const CLIENT_ID = 'seu_client_id_aqui';
```

Client-ID é público por natureza — pode ir versionado/commitado sem risco.

### 3. Carregar a extensão e registrar o Redirect URL

1. `chrome://extensions` → ative o **Modo do desenvolvedor** → **Carregar sem
   compactação** → selecione a pasta do projeto. **Não mova a pasta depois.**
2. Anote o **ID da extensão** mostrado no card. O Redirect URL é
   `https://<id-da-extensão>.chromiumapp.org/`.
3. Volte ao app na Twitch (passo 1), edite e adicione esse URL em
   **OAuth Redirect URLs**. Salve.
   - A Twitch aceita vários redirect URLs — ao publicar, adicione também o da
     versão publicada (o ID muda na loja).

### 4. Testar (como usuário final faria)

1. Clique no ícone → **Conectar com a Twitch** e autorize.
2. Marque os canais ao vivo que quer rotacionar.
3. **Iniciar** abre o grupo "Rotacionando" com 2 abas; **Pausar** congela;
   **Parar** fecha o grupo.

## Desenvolvimento

```bash
npm install
npm test       # roda os testes da lógica pura
```

Os módulos com efeito colateral do Chrome (`background.js`, popup, opções) são
validados por smoke test manual no navegador.
