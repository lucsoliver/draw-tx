# draw-tx

Editor de desenho e texto em navegador, com visual compacto e inspirados em fluxos de design tools como Figma. O projeto foi reestruturado para facilitar manutenção, com componentes separados por responsabilidade e uma base mais próxima de boas práticas de arquitetura front-end.

<br>
<img src="public/images/draw-tx-website.png" alt="Screenshot do editor" style="width:auto; height:auto;" align="center">
<br>

## Visão geral

O app permite:

- desenhar livremente com caneta
- apagar traços com borracha
- inserir textos em qualquer ponto do canvas
- criar formas geométricas
- selecionar, mover e remover objetos
- controlar zoom e pan do editor
- alternar entre temas claro e escuro
- desfazer/refazer ações e exportar o resultado em PNG

## Estrutura do projeto

```text
app/
├── components/
│   ├── DrawingEditor.jsx
│   └── drawing-editor/
│       ├── EditorToolbar.jsx
│       ├── EditorCanvasStage.jsx
│       └── ZoomControls.jsx
├── globals.css
├── layout.js
└── page.js
public/
└── images/
```

## Principais módulos

### DrawingEditor
Responsável pela lógica principal do editor, estado global, histórico, seleção, renderização do canvas e interações do usuário.

### EditorToolbar
Agrupa a barra de ferramentas, abas, controles de tema, paleta de cores, espessura, tamanho de texto e ações gerais do editor.

### EditorCanvasStage
Cuida da área de desenho, overlays de seleção, drag, resize visual e botão de edição/deleção para objetos selecionados.

### ZoomControls
Centraliza o controle de zoom em porcentagem e a interação de edição direta do valor de zoom.

## Funcionalidades atuais

- Caneta e borracha
- Texto com edição em tempo real
- Formas: retângulo, elipse, linha, quadrado, retângulo com borda, losango e seta
- Seleção de objetos e movimentação no canvas
- Deleção de itens selecionados
- Ajuste de zoom com wheel, botões e entrada numérica
- Pan do canvas com movimento natural
- Sistema de abas de trabalho
- Tema claro/escuro
- Histórico de ações com undo/redo
- Exportação para PNG

## Tecnologias

- Next.js 16
- React 19
- Lucide React
- Canvas API do navegador
- CSS modularizado para componentes da UI

## Requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
```

## Execução

```bash
npm run dev
```

Depois, abra:

```text
http://localhost:3000
```

## Como usar

1. Selecione a ferramenta desejada na barra superior.
2. Para desenhar, use a caneta.
3. Para inserir texto, clique em texto e depois no canvas.
4. Ajuste espessura e tamanho conforme necessário.
5. Use seleção para mover ou remover elementos.
6. Use o zoom para ampliar/reduzir o espaço de desenho.
7. Clique em download para exportar a imagem final em PNG.

## Manutenção

A organização atual foi pensada para facilitar evolução futura:

- nova ferramenta em uma área isolada
- lógica de renderização no principal editor
- UI em componentes específicos
- alterações visuais sem misturar com lógica do canvas

Se houver novas features, o ideal é continuar adicionando blocos pequenos e coesos em vez de concentrar tudo em um único arquivo.

