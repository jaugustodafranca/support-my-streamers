# Política de Privacidade — Support My Streamers

_Última atualização: 2026-06-10_

A extensão **Support My Streamers** foi feita para respeitar sua privacidade.
Ela **não tem servidor próprio e não envia seus dados para lugar nenhum** além
da própria API oficial da Twitch, e somente em seu nome.

## O que a extensão acessa

Para funcionar, a extensão guarda **localmente no seu navegador**
(`chrome.storage.local`, no seu dispositivo):

- O **token de acesso** gerado quando você conecta sua conta da Twitch.
- Seu **identificador, login e nome de exibição** da Twitch (em cache).
- Suas **configurações**: tempo de rotação, áudio, idioma e os canais que você
  marcou para rotacionar.

Durante o uso, a extensão consulta a **API oficial da Twitch** (`api.twitch.tv`)
para listar quais dos canais que você segue estão ao vivo. Essa consulta usa o
seu token e o escopo mínimo `user:read:follows`.

## O que a extensão NÃO faz

- **Não** envia seus dados para servidores nossos (não temos servidor).
- **Não** usa analytics, rastreadores ou cookies de terceiros.
- **Não** compartilha ou vende qualquer informação.
- **Não** acessa nada além da sua lista de follows ao vivo.

## Onde seus dados ficam

Tudo fica apenas no seu navegador. Nada sai do seu dispositivo, exceto as
chamadas diretas e autenticadas à API da Twitch que você autorizou.

## Como remover seus dados

- Clicar em **"sair"** no popup remove o token salvo.
- **Remover a extensão** do Chrome apaga todos os dados locais dela.
- Você também pode revogar o acesso a qualquer momento em
  [twitch.tv/settings/connections](https://www.twitch.tv/settings/connections).

## Contato

Dúvidas sobre privacidade: contato@zaintech.com.br
