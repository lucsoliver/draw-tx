import {
  Pencil,
  Type,
  Eraser,
  Trash2,
  Download,
  Undo,
  Redo,
  Plus,
  X,
  Sun,
  Moon,
  Move,
  MousePointer2,
} from 'lucide-react';

export default function EditorToolbar({
  activeId,
  tabs,
  theme,
  tool,
  setTool,
  shapeType,
  setShapeType,
  editingId,
  nameDraft,
  nameInputRef,
  setNameDraft,
  commitRename,
  setEditingId,
  selectTab,
  beginRename,
  closeTab,
  addTab,
  toggleTheme,
  undo,
  redo,
  clearCanvas,
  downloadImage,
  lineWidth,
  setLineWidth,
  fontSize,
  setFontSize,
  colors,
  color,
  setColor,
  shapeColor,
  setShapeColor,
  onColorPick,
  isTyping,
  history,
  historyStep,
}) {
  return (
    <>
      <div className="tab-bar">
        <div className="tab-list" role="tablist" aria-label="Abas do editor">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              role="tab"
              aria-selected={tab.id === activeId}
              className={`editor-tab ${tab.id === activeId ? 'active' : ''}`}
              onClick={() => selectTab(tab.id)}
              onDoubleClick={() => beginRename(tab)}
              title="Duplo clique para renomear"
            >
              {editingId === tab.id ? (
                <input
                  ref={nameInputRef}
                  className="tab-name-input"
                  value={nameDraft}
                  maxLength={24}
                  aria-label="Nome da aba"
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    } else if (event.key === 'Escape') {
                      if (typeof skipRenameCommitRef !== 'undefined') {
                        skipRenameCommitRef.current = true;
                      }
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <span className="tab-name">{tab.name}</span>
              )}
              {tab.id === activeId && editingId !== tab.id && (
                <button
                  type="button"
                  className="tab-icon-button"
                  title="Renomear aba"
                  onClick={(event) => {
                    event.stopPropagation();
                    beginRename(tab);
                  }}
                >
                  <Pencil size={13} />
                </button>
              )}
              {tabs.length > 1 && (
                <button
                  type="button"
                  className="tab-icon-button"
                  title="Fechar aba"
                  onClick={(event) => closeTab(tab.id, event)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="tab-add"
            onClick={addTab}
            disabled={tabs.length >= 3}
            title={tabs.length >= 3 ? 'Máximo de 3 abas' : 'Nova aba'}
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          type="button"
          className="tool-button theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          aria-label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="drawing-toolbar">
        <div className="toolbar-group toolbar-tools">
          <button
            onClick={() => setTool('select')}
            className={`tool-button ${tool === 'select' ? 'active' : ''}`}
            title="Selecionar"
            aria-label="Selecionar"
          >
            <MousePointer2 size={18} />
          </button>

          <button
            onClick={() => setTool('pan')}
            className={`tool-button ${tool === 'pan' ? 'active' : ''}`}
            title="Mover"
            aria-label="Mover"
          >
            <Move size={18} />
          </button>

          <button
            onClick={() => setTool('pen')}
            className={`tool-button ${tool === 'pen' ? 'active' : ''}`}
            title="Caneta"
            aria-label="Caneta"
          >
            <Pencil size={18} />
          </button>

          <button
            onClick={() => setTool('eraser')}
            className={`tool-button ${tool === 'eraser' ? 'active' : ''}`}
            title="Borracha"
            aria-label="Borracha"
          >
            <Eraser size={18} />
          </button>

          <button
            onClick={() => setTool('text')}
            className={`tool-button ${tool === 'text' ? 'active' : ''}`}
            title="Texto"
            aria-label="Texto"
          >
            <Type size={18} />
          </button>

          <button
            onClick={() => setTool('shape')}
            className={`tool-button ${tool === 'shape' ? 'active' : ''}`}
            title="Formas"
            aria-label="Formas"
          >
            ▭
          </button>

          {tool === 'shape' && (
            <div className="shape-selector" aria-label="Tipos de forma">
              {[
                { id: 'rectangle', label: '▭', name: 'Retângulo' },
                { id: 'ellipse', label: '◯', name: 'Elipse' },
                { id: 'line', label: '／', name: 'Linha' },
                { id: 'square', label: '□', name: 'Quadrado' },
                { id: 'outline-rectangle', label: '▢', name: 'Retângulo com borda' },
                { id: 'diamond', label: '◇', name: 'Losango' },
                { id: 'arrow', label: '→', name: 'Seta' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`shape-button ${shapeType === item.id ? 'active' : ''}`}
                  title={item.name}
                  aria-label={item.name}
                  onClick={() => setShapeType(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="toolbar-divider" aria-hidden="true" />
        </div>

        <div className="toolbar-group toolbar-actions">
          <button onClick={undo} className="tool-button" title="Desfazer" aria-label="Desfazer" disabled={isTyping || historyStep <= 0}>
            <Undo size={18} />
          </button>
          <button onClick={redo} className="tool-button" title="Refazer" aria-label="Refazer" disabled={isTyping || historyStep >= history.length - 1}>
            <Redo size={18} />
          </button>
          <button onClick={clearCanvas} className="button-clear" title="Limpar" aria-label="Limpar">
            <Trash2 size={18} />
          </button>
          <button onClick={downloadImage} className="button-download" title="Baixar" aria-label="Baixar">
            <Download size={18} />
          </button>
        </div>

        <div className="toolbar-group toolbar-settings">
          {tool === 'pen' && (
            <div className="setting-group">
              <label className="setting-label">Espessura</label>
              <input
                type="range"
                min="1"
                max="20"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="setting-input"
              />
              <span className="setting-value">{lineWidth}</span>
            </div>
          )}

          {tool === 'text' && (
            <div className="setting-group">
              <label className="setting-label">Tamanho</label>
              <input
                type="range"
                min="12"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="setting-input"
              />
              <span className="setting-value">{fontSize}</span>
            </div>
          )}

          <div className="color-picker-group">
            <div className="color-swatches">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => onColorPick(c)}
                  className={`color-swatch ${(tool === 'shape' ? shapeColor : color) === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={`Selecionar cor ${c}`}
                />
              ))}
              <input
                type="color"
                value={tool === 'shape' ? shapeColor : color}
                onChange={(e) => onColorPick(e.target.value)}
                className="color-input"
                title="Escolher cor personalizada"
                aria-label="Escolher cor personalizada"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
