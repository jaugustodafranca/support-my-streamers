# Support My Streamers

Extensão de Chrome que autentica na Twitch, lista os streamers que você segue
que estão **ao vivo** e roda um "lurking" pessoal: você escolhe canais e a
extensão abre 2 por vez num grupo de abas, rotacionando a cada N minutos.

É uma ferramenta de lurking pessoal — um humano real acompanhando canais que ele
escolheu. Não inflama audiência de terceiros, não direciona viewers por servidor
e não simula chat.

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
  popup/               UI de ação rápida (play/pause/seleção)
  options/             Configurações + Client-ID
test/                  Testes (Vitest) da lógica pura
```

## Setup (uma vez)

### 1. Criar a aplicação na Twitch

1. Acesse <https://dev.twitch.tv/console/apps> e clique em **Register Your Application**.
2. **Name**: qualquer nome (ex.: "Support My Streamers").
3. **OAuth Redirect URLs**: deixe em branco por enquanto — você vai voltar aqui no passo 3.
4. **Category**: Application Integration.
5. Salve e copie o **Client ID**.

### 2. Carregar a extensão no Chrome

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta deste projeto.
4. A extensão aparece na lista. **Não mova a pasta depois** — o ID da extensão
   (e o Redirect URL) dependem do caminho.

### 3. Configurar e ligar o Redirect URL

1. Clique no ícone da extensão → **Abrir Opções** (ou botão direito → Opções).
2. Cole o **Client-ID** copiado no passo 1.
3. Copie o **OAuth Redirect URL** mostrado na tela
   (algo como `https://<id>.chromiumapp.org/`).
4. Volte ao app na Twitch (passo 1), edite e cole esse URL em
   **OAuth Redirect URLs**. Salve.
5. Nas Opções, clique em **Salvar**.

### 4. Usar

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
