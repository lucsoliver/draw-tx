# draw-tx

Editor de desenho e texto em navegador, com visual compacto e inspirados em fluxos de design tools como Figma. O projeto foi reestruturado para facilitar manutenção, com componentes separados por responsabilidade e uma base mais próxima de boas práticas de arquitetura front-end.

<br>
<img src="public/images/draw-tx-website.png" alt="Screenshot do editor" style="width:auto; height:auto;" align="center">
<br>

## Funcionalidades 

- Caneta e borracha
- Texto com edição
- Formas: retângulo, elipse, linha, quadrado, retângulo com borda, losango e seta
- Seleção de objetos e movimentação no canvas
- Deleção de itens selecionados
- Ajuste de zoom
- Abas
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

