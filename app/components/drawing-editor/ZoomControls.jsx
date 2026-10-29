export default function ZoomControls({
  shellRef,
  zoom,
  zoomInputValue,
  setZoomInputValue,
  isZoomEditing,
  setIsZoomEditing,
  clampZoom,
  handleZoom,
}) {
  return (
    <div className="zoom-controls" aria-label="Controle de zoom do canvas">
      <button
        type="button"
        className="zoom-button"
        onClick={() => {
          const rect = shellRef.current?.getBoundingClientRect();
          handleZoom(zoom - 0.1, rect ? rect.left + rect.width / 2 : window.innerWidth / 2, rect ? rect.top + rect.height / 2 : window.innerHeight / 2);
        }}
        aria-label="Diminuir zoom"
      >
        −
      </button>

      {isZoomEditing ? (
        <input
          className="zoom-input"
          type="number"
          min="50"
          max="400"
          step="5"
          value={zoomInputValue}
          onChange={(event) => setZoomInputValue(event.target.value)}
          onBlur={() => {
            const cleaned = zoomInputValue.trim();
            if (cleaned === '') {
              setZoomInputValue(String(Math.round(zoom * 100)));
            } else {
              const nextValue = Number(cleaned);
              if (Number.isFinite(nextValue)) {
                const normalized = clampZoom(nextValue / 100);
                const rect = shellRef.current?.getBoundingClientRect();
                handleZoom(normalized, rect ? rect.left + rect.width / 2 : window.innerWidth / 2, rect ? rect.top + rect.height / 2 : window.innerHeight / 2);
                setZoomInputValue(String(Math.round(normalized * 100)));
              }
            }
            setIsZoomEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              const cleaned = zoomInputValue.trim();
              if (cleaned === '') {
                setZoomInputValue(String(Math.round(zoom * 100)));
                setIsZoomEditing(false);
                return;
              }

              const nextValue = Number(cleaned);
              if (Number.isFinite(nextValue)) {
                const normalized = clampZoom(nextValue / 100);
                const rect = shellRef.current?.getBoundingClientRect();
                handleZoom(normalized, rect ? rect.left + rect.width / 2 : window.innerWidth / 2, rect ? rect.top + rect.height / 2 : window.innerHeight / 2);
                setZoomInputValue(String(Math.round(normalized * 100)));
              }
              setIsZoomEditing(false);
            }

            if (event.key === 'Escape') {
              setZoomInputValue(String(Math.round(zoom * 100)));
              setIsZoomEditing(false);
            }
          }}
          autoFocus
          aria-label="Zoom em porcentagem"
        />
      ) : (
        <button
          type="button"
          className="zoom-value"
          onClick={() => {
            setZoomInputValue(String(Math.round(zoom * 100)));
            setIsZoomEditing(true);
          }}
          aria-label="Editar zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
      )}

      <button
        type="button"
        className="zoom-button"
        onClick={() => {
          const rect = shellRef.current?.getBoundingClientRect();
          handleZoom(zoom + 0.1, rect ? rect.left + rect.width / 2 : window.innerWidth / 2, rect ? rect.top + rect.height / 2 : window.innerHeight / 2);
        }}
        aria-label="Aumentar zoom"
      >
        +
      </button>
    </div>
  );
}
