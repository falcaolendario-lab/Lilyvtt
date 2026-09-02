# LilyVTT — Beta local + online

Protótipo de um VTT leve com foco em uma experiência simples como uma mesa compartilhada.

## O que já existe

- modo **Mestre** e modo **Player**;
- biblioteca persistente do Mestre;
- importação de mapas como imagens;
- tokens reutilizáveis;
- múltiplas imagens por token;
- troca de estado pelas teclas `1` a `9`;
- tokens pertencentes a jogadores;
- tokens com visibilidade individual para os Players;
- permissões para mover e editar estados;
- redimensionamento direto dos tokens pelos cantos ou pela roda do mouse;
- exclusão de qualquer objeto selecionado com `Ctrl+X` (`Delete` também funciona);
- câmera com arraste do fundo, zoom pela roda do mouse e botão de centralizar;
- grid quadrado configurável, com linhas finas e baixa opacidade;
- tokens que se encaixam no centro das células do grid;
- paredes desenhadas no canvas, com tipos parede, porta e janela;
- portas que podem ser abertas/fechadas e janelas que deixam passar visão/luz, mas bloqueiam movimento;
- colisão de movimento considerando o corpo do token e as aberturas;
- máscara de visão com luz suave e barreiras;
- áreas escuras manuais, texturizadas e reposicionáveis;
- hotspots narrativos;
- sequências com imagens e frases;
- armazenamento local para preservar as preparações do Mestre;
- sala online com WebSocket, código de sala e credencial privada do Mestre;
- estado público filtrado para os Players, sem tokens ocultos ou controles do Mestre.

## Teste rápido

1. Abra o projeto em um servidor local.
2. No modo Mestre, importe um mapa.
3. Crie um token e selecione várias imagens.
4. Adicione o token ao canvas e arraste-o no modo **Selecionar**.
5. Arraste o fundo para mover a câmera; use a roda do mouse para aproximar ou afastar.
6. Selecione o token e teste as teclas `1`, `2` e `3`.
7. Troque o mapa na Biblioteca: o token continua salvo na cena.
8. No painel **Cena**, escolha o tipo de segmento e use `W` para desenhar uma parede, porta ou janela. Selecione um segmento para arrastar, editar ou excluir; dê duplo clique numa porta para abrir/fechar.
9. Ainda no painel **Cena**, ajuste o grid e deixe **Centralizar tokens no grid** ligado para posicionar os tokens no centro das células.
10. Use `L` para colocar uma luz, `D` para criar uma área escura e `H` para testar uma animação.
11. Alterne para Player e teste as permissões.

No modo Mestre, selecione um token para mostrar os quatro cantos de redimensionamento. Desative `Visível para Players` no Inspector para ocultá-lo sem removê-lo da cena.

## Sala online

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/falcaolendario-lab/Lilyvtt)

Para testar a sala completa localmente:

```bash
npm install
npm start
```

Depois abra `http://localhost:8787/`. O Mestre cria uma sala online automaticamente e o botão `Compartilhar player` gera um link para outro dispositivo. O servidor salva as salas em `server/data/rooms.json`.

O GitHub Pages continua sendo a versão estática. Para conectá-lo a um servidor publicado, abra o site com `?server=https://URL-DO-SERVICO`; o link de Player gerado pelo Mestre já carregará essa configuração. O `render.yaml` contém a configuração inicial para publicar o servidor como Web Service Node.

O caminho mais simples é clicar no botão acima, aprovar o serviço no Render e abrir a URL `onrender.com` que ele fornecer. Nesse endereço o próprio tabletop e o servidor ficam juntos; o Mestre cria a sala automaticamente e o botão `Compartilhar player` gera o link completo.

O armazenamento JSON é adequado para o beta e para desenvolvimento. Em produção, use disco persistente ou banco externo para não perder salas ao recriar o serviço.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md) para o modelo de dados e o plano da sala online.
