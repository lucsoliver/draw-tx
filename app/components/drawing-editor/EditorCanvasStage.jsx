import { Pencil } from 'lucide-react';

export default function EditorCanvasStage({
  shellRef,
  canvasRef,
  tool,
  pan,
  zoom,
  draw,
  stopDrawing,
  startDrawing,
  selectionInfo,
  getCanvasPoint,
  setSelectedObject,
  dragSelectionRef,
  resizeSelectionRef,
  deleteSelectedObject,
  beginEditingTextObject,
  onWheel,
}) {
  return (
    <div className="canvas-container">
      <div
        ref={shellRef}
        className="canvas-shell"
        onWheel={onWheel}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      >
        <div className="canvas-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            className={`canvas-element ${tool === 'pan' ? 'pan-mode' : ''} ${tool === 'select' ? 'select-mode' : ''}`}
          />

          {selectionInfo.object && (selectionInfo.object.type === 'shape' || selectionInfo.object.type === 'text') && selectionInfo.bounds && (
            <>
              <button
                type="button"
                className="selection-box"
                aria-label="Mover item selecionado"
                onMouseDown={(event) => {
                  event.stopPropagation();
                  const point = getCanvasPoint(event);
                  setSelectedObject(selectionInfo.object.id);
                  dragSelectionRef.current = {
                    objectId: selectionInfo.object.id,
                    startX: point.x,
                    startY: point.y,
                  };
                }}
                style={{
                  left: `${selectionInfo.bounds.x - 10}px`,
                  top: `${selectionInfo.bounds.y - 10}px`,
                  width: `${selectionInfo.bounds.width + 20}px`,
                  height: `${selectionInfo.bounds.height + 20}px`,
                }}
              />

              {selectionInfo.object.type === 'shape' && ['nw', 'ne', 'sw', 'se'].map((handle) => {
                const left =
                  handle.includes('w')
                    ? selectionInfo.bounds.x - 7
                    : selectionInfo.bounds.x + selectionInfo.bounds.width - 7;
                const top =
                  handle.includes('n')
                    ? selectionInfo.bounds.y - 7
                    : selectionInfo.bounds.y + selectionInfo.bounds.height - 7;

                return (
                  <button
                    key={handle}
                    type="button"
                    className="selection-handle"
                    data-resize-handle={handle}
                    aria-label={`Redimensionar ${handle}`}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      const point = getCanvasPoint(event);
                      resizeSelectionRef.current = {
                        objectId: selectionInfo.object.id,
                        handle,
                        startX: point.x,
                        startY: point.y,
                        startBounds: { ...selectionInfo.bounds },
                        startObject: { ...selectionInfo.object },
                      };
                    }}
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                    }}
                  />
                );
              })}

              <button
                type="button"
                className="selection-delete-button"
                aria-label="Excluir item selecionado"
                onClick={deleteSelectedObject}
                style={{
                  left: `${selectionInfo.bounds.x + selectionInfo.bounds.width + 10}px`,
                  top: `${selectionInfo.bounds.y - 8}px`,
                }}
              >
                ×
              </button>

              {selectionInfo.object.type === 'text' && (
                <button
                  type="button"
                  className="selection-edit-button"
                  aria-label="Editar texto selecionado"
                  onClick={(event) => {
                    event.stopPropagation();
                    beginEditingTextObject(selectionInfo.object);
                  }}
                  style={{
                    left: `${selectionInfo.bounds.x + selectionInfo.bounds.width + 10}px`,
                    top: `${selectionInfo.bounds.y + 20}px`,
                  }}
                >
                  <Pencil size={11} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
