# Tabletop RPG — arquitetura do beta

## Princípio principal

O projeto separa **biblioteca** de **cena**.

- A biblioteca do Mestre guarda mapas, modelos de tokens, imagens/estados e sequências narrativas.
- A cena guarda somente as instâncias colocadas no canvas: posição, escala, rotação, dono e estado atual.
- Trocar o mapa da cena nunca remove um modelo da biblioteca nem apaga os tokens já posicionados.

## Modelo de dados

```text
Room
├── members[]
├── permissions{}
├── library
│   ├── maps[]
│   ├── tokenBlueprints[]
│   └── sequences[]
└── scenes[]
    ├── mapAssetId
    ├── tokens[]
    ├── walls[]
    ├── lights[]
    └── hotspots[]
```

### Biblioteca do Mestre

`tokenBlueprints` são modelos reutilizáveis. Cada modelo possui imagens associadas a teclas (`1` a `9`). Uma instância de token referencia o modelo através de `blueprintId`.

### Cena

Uma cena referencia um mapa através de `mapAssetId`. As paredes, luzes e tokens são específicos daquela cena. Os assets continuam disponíveis para outras cenas.

### Permissões

O beta local já possui permissões para:

- mover o próprio token;
- trocar estados do próprio token;
- interagir com sequências narrativas;
- usar pings e medição.

Na versão online, a permissão deverá ser validada no servidor, e não apenas escondida na interface.

## Canvas

Camadas planejadas:

```text
Mapa
→ Máscara de iluminação/visão
→ Objetos e hotspots
→ Tokens
→ Efeitos e primeiro plano
→ Interface de diálogo
```

As barreiras usam coordenadas normalizadas (`0` a `1`) para continuarem corretas quando a câmera mudar de tamanho. Cada barreira tem regras independentes para movimento, visão e luz.

O beta já possui uma máscara de visão experimental baseada em polígonos de visibilidade. Ela usa as mesmas barreiras para construir sombras e bloquear movimento.

## Modos de acesso

### Mestre

Pode editar a cena, importar assets, criar barreiras/luzes/hotspots, posicionar qualquer token e alterar permissões.

### Player

Recebe uma tela limpa, sem ferramentas de edição. Pode mover e alterar apenas o que o Mestre liberar. O link de Player desta versão é um modo de demonstração local; a sala online real será a próxima camada.

## Próxima camada: sala online

Quando o beta local estiver aprovado, o armazenamento poderá ser dividido em:

```text
Room database
├── rooms
├── members
├── permissions
├── assets
├── token_blueprints
├── scenes
├── scene_tokens
├── barriers
├── lights
└── sequences
```

As ações serão eventos de sala, por exemplo:

```json
{
  "type": "token.moved",
  "roomId": "room-01",
  "tokenId": "token-01",
  "position": { "x": 0.42, "y": 0.52 }
}
```

O servidor verifica a permissão, salva o novo estado e retransmite o evento para os clientes autorizados.

## Rodar localmente

Na pasta do projeto:

```bash
python3 -m http.server 4173
```

Depois, abra `http://localhost:4173` no navegador. O estado do beta fica salvo no armazenamento local do navegador.

## Limites intencionais do beta

- Não há sincronização entre dispositivos ainda.
- Os arquivos enviados ficam no armazenamento local do navegador.
- A máscara de luz é uma primeira versão geométrica; portas, janelas, luzes cônicas e sombras suaves entram depois.
- A sequência narrativa já aceita vários frames de imagem e uma frase por frame, mas ainda não possui ramificações ou áudio.
