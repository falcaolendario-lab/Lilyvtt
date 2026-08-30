# Tabletop RPG — Beta local

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
- grid quadrado sempre visível, com linhas finas e baixa opacidade;
- barreiras desenhadas no canvas;
- colisão básica de movimento;
- máscara de visão com luz suave e barreiras;
- áreas escuras manuais, texturizadas e reposicionáveis;
- hotspots narrativos;
- sequências com imagens e frases;
- armazenamento local para preservar as preparações do Mestre.

## Teste rápido

1. Abra o projeto em um servidor local.
2. No modo Mestre, importe um mapa.
3. Crie um token e selecione várias imagens.
4. Adicione o token ao canvas e arraste-o no modo **Selecionar**.
5. Arraste o fundo para mover a câmera; use a roda do mouse para aproximar ou afastar.
6. Selecione o token e teste as teclas `1`, `2` e `3`.
7. Troque o mapa na Biblioteca: o token continua salvo na cena.
8. Use `W` para desenhar uma barreira, `L` para colocar uma luz, `D` para criar uma área escura e `H` para testar uma animação.
9. Alterne para Player e teste as permissões.

No modo Mestre, selecione um token para mostrar os quatro cantos de redimensionamento. Desative `Visível para Players` no Inspector para ocultá-lo sem removê-lo da cena.

## Próximo marco

O próximo passo é substituir o armazenamento local por uma sala online com link real, aprovação de entrada, sincronização de eventos e validação de permissões no servidor.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md) para o modelo de dados e o plano da sala online.
