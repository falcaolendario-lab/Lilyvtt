# Servidor online do LilyVTT

O servidor usa HTTP para servir o tabletop e WebSocket para sincronizar a sala em tempo real.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:8787/`. Quando a página é servida pelo próprio servidor, o Mestre cria uma sala online automaticamente. O botão `Compartilhar player` gera o link do Player.

O estado das salas fica em `server/data/rooms.json`. O arquivo é criado automaticamente e contém o estado da mesa e apenas o hash da credencial do Mestre.

## Publicar

O arquivo `render.yaml` já deixa o projeto pronto para um Web Service Node no Render. Depois do deploy, a URL do serviço pode ser usada pelo site estático com `?server=https://URL-DO-SERVICO` ou configurada no `meta[name="lily-server-url"]` do `index.html`.

Para uma campanha persistente, o serviço precisa de um disco persistente ou de um banco externo. O armazenamento JSON é adequado para este beta e para desenvolvimento local.

## Regras do servidor

- O Mestre possui um token secreto e pode enviar o estado completo.
- O Player recebe mapa, tokens visíveis, luzes e áreas escuras.
- O Player não recebe a biblioteca completa, sequências administrativas ou tokens ocultos. A geometria das barreiras é enviada apenas para a máscara de luz/visão e não aparece como ferramenta de edição.
- O Player só pode enviar posição e estado visual do próprio token, de acordo com as permissões da sala.
