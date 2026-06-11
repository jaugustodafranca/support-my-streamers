# Chrome Web Store — Textos para o cadastro

Cole estes textos no Developer Dashboard ao publicar.

## Nome
Support My Streamers

## Resumo curto (até 132 caracteres)
**PT:** Acompanhe e apoie os streamers que você segue na Twitch, com rotação automática entre quem está ao vivo.
**EN:** Follow and support the Twitch streamers you love, with automatic rotation between who's live.

## Descrição completa

**PT:**
Support My Streamers conecta na sua conta da Twitch e mostra, num clique, quais
dos canais que você segue estão ao vivo agora.

Escolha quem você quer acompanhar e a extensão abre os streams num grupo de abas,
revezando entre eles a cada X minutos — assim você prestigia vários streamers
sem ficar trocando de aba na mão.

Recursos:
• Login rápido com a Twitch (só leitura da sua lista de follows).
• Lista dos seus follows que estão ao vivo, com jogo e nº de espectadores.
• Rotação automática com tempo configurável (de 5 minutos até "não trocar").
• Play, pausar e parar quando quiser.
• Áudio mudo ou com som, à sua escolha.
• Interface em português e inglês.

Privacidade: a extensão não tem servidor e não envia seus dados para lugar
nenhum — tudo fica no seu navegador. Acessa apenas sua lista de follows ao vivo,
pela API oficial da Twitch.

**EN:**
Support My Streamers connects to your Twitch account and shows, in one click,
which of the channels you follow are live right now.

Pick who you want to keep up with and the extension opens their streams in a tab
group, rotating between them every few minutes — so you support several
streamers without switching tabs by hand.

Features:
• Quick Twitch login (read-only access to your follows).
• List of your follows that are live, with game and viewer count.
• Automatic rotation with configurable timing (from 5 minutes to "never switch").
• Play, pause and stop anytime.
• Muted or with sound, your choice.
• Interface in Portuguese and English.

Privacy: the extension has no server and sends your data nowhere — everything
stays in your browser. It only reads your live follows, via Twitch's official API.

## Categoria
Entertainment (ou Social & Communication)

## Justificativa das permissões (campo "Privacy practices")

- **identity**: usada para o login OAuth com a Twitch.
- **storage**: salvar localmente o token de acesso e suas configurações.
- **tabGroups**: agrupar as abas dos streams num grupo nomeado.
- **alarms**: agendar o timer da rotação.
- **scripting**: injetar o script do player nas abas da Twitch (volume).
- **host permission `https://api.twitch.tv/*`**: chamar a API oficial da Twitch
  para listar os canais seguidos que estão ao vivo.
- **host permission `https://www.twitch.tv/*`**: abrir, atualizar e ler URLs das
  abas de stream da Twitch durante a rotação (sem acesso ao resto do navegador).
- **Justificativa de uso remoto de código**: nenhuma. A extensão não executa
  código remoto; todo o código está no pacote.

## URL da política de privacidade
https://zaintech.com.br/support-my-streamers/privacy

(Hospedada no site da Zaintech, em `personal/zaintech` → rota
`src/app/support-my-streamers/privacy`. Contato: contato@zaintech.com.br.)
