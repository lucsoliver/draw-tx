'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Type, Eraser, Trash2, Download, Undo, Redo, Plus, X, Sun, Moon } from 'lucide-react';
import './DrawingEditor.css';

const MAX_TABS = 3;
const THEME_KEY = 'draw-tx-theme';

function createTab(name) {
  return { id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name };
}

export default function DrawingTextEditor() {
  const canvasRef = useRef(null);
  const baseImageDataRef = useRef(null);
  const historyRef = useRef([]);
  const historyStepRef = useRef(-1);
  const isDrawingRef = useRef(false);
  const snapshotsRef = useRef(new Map());
  const restoreTokenRef = useRef(0);
  const nameCounterRef = useRef(1);
  const skipRenameCommitRef = useRef(false);
  const nameInputRef = useRef(null);

  const [workspace, setWorkspace] = useState(() => {
    const tab = createTab('Aba 1');
    return { tabs: [tab], activeId: tab.id };
  });
  const tabs = workspace.tabs;
  const activeId = workspace.activeId;
  const setTabs = (updater) => {
    setWorkspace((prev) => ({
      ...prev,
      tabs: typeof updater === 'function' ? updater(prev.tabs) : updater,
    }));
  };
  const setActiveId = (nextId) => {
    setWorkspace((prev) => ({
      ...prev,
      activeId: typeof nextId === 'function' ? nextId(prev.activeId) : nextId,
    }));
  };

  const [editingId, setEditingId] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [theme, setTheme] = useState('light');

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFFFFF'];

  const activeTab = tabs.find((tab) => tab.id === activeId) || tabs[0];

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
      return;
    }
    const saved = localStorage.getItem(THEME_KEY);
    const next = saved === 'dark' || saved === 'light'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const init = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (!width || !height) {
        requestAnimationFrame(init);
        return;
      }
      if (canvas.dataset.init === '1') return;
      canvas.dataset.init = '1';
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveToHistory();
    };

    init();
  }, []);

  useEffect(() => {
    if (editingId && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isTyping && textPosition) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const canvas = canvasRef.current;
          const finalize = () => {
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx.font = `${fontSize}px Arial`;
              ctx.fillStyle = color;
              ctx.fillText(textInput, textPosition.x, textPosition.y);
            }

            setIsTyping(false);
            setTextPosition(null);
            setTextInput('');
            baseImageDataRef.current = null;
            saveToHistory();
          };

          if (baseImageDataRef.current) {
            const ctx = canvas.getContext('2d');
            ctx.putImageData(baseImageDataRef.current, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            finalize();
          } else if (historyStep >= 0) {
            restoreFromHistory(historyStep, () => {
              const ctx = canvas.getContext('2d');
              ctx.globalCompositeOperation = 'source-over';
              finalize();
            });
          } else {
            const ctx = canvas.getContext('2d');
            ctx.globalCompositeOperation = 'source-over';
            finalize();
          }
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          setTextInput((prev) => prev.slice(0, -1));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (baseImageDataRef.current) {
              ctx.putImageData(baseImageDataRef.current, 0, 0);
            } else if (historyStep >= 0) {
              restoreFromHistory(historyStep);
            }
          }
          setIsTyping(false);
          setTextPosition(null);
          setTextInput('');
          baseImageDataRef.current = null;
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setTextInput((prev) => prev + e.key);
        }
      }
    };

    if (isTyping) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [isTyping, textPosition, textInput, historyStep, fontSize, color]);

  useEffect(() => {
    if (!isTyping || !textPosition) return;

    const frame = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (baseImageDataRef.current) {
        ctx.putImageData(baseImageDataRef.current, 0, 0);
      } else if (historyStep >= 0) {
        restoreFromHistory(historyStep);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = color;
      ctx.fillText(textInput, textPosition.x, textPosition.y);

      const textWidth = ctx.measureText(textInput || '').width;
      ctx.fillRect(textPosition.x + textWidth, textPosition.y - fontSize, 2, fontSize);
    });

    return () => cancelAnimationFrame(frame);
  }, [textInput, isTyping, textPosition, color, fontSize, historyStep]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newHistory = historyRef.current.slice(0, historyStepRef.current + 1);
    newHistory.push(canvas.toDataURL());
    historyRef.current = newHistory;
    historyStepRef.current = newHistory.length - 1;
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const restoreFromHistory = (step, cb) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      if (cb) cb();
      return;
    }
    const ctx = canvas.getContext('2d');
    const src = historyRef.current[step];
    if (!src) {
      if (cb) cb();
      return;
    }
    const img = new Image();
    img.src = src;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (cb) cb();
    };
    img.onerror = () => {
      if (cb) cb();
    };
  };

  const captureSnapshot = () => ({
    history: historyRef.current.slice(),
    historyStep: historyStepRef.current,
    isTyping,
    textInput,
    textPosition: textPosition ? { ...textPosition } : null,
    tool,
    color,
    lineWidth,
    fontSize,
  });

  const resetCanvasToBlank = () => {
    restoreTokenRef.current += 1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL();
    historyRef.current = [url];
    historyStepRef.current = 0;
    setHistory([url]);
    setHistoryStep(0);
    setIsTyping(false);
    setTextInput('');
    setTextPosition(null);
    baseImageDataRef.current = null;
    isDrawingRef.current = false;
  };

  const restoreSnapshot = (snap) => {
    const token = ++restoreTokenRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !snap) return;

    historyRef.current = snap.history;
    historyStepRef.current = snap.historyStep;
    setHistory(snap.history);
    setHistoryStep(snap.historyStep);
    setTool(snap.tool);
    setColor(snap.color);
    setLineWidth(snap.lineWidth);
    setFontSize(snap.fontSize);
    setTextInput(snap.textInput || '');
    setTextPosition(snap.textPosition);
    setIsTyping(false);
    baseImageDataRef.current = null;
    isDrawingRef.current = false;

    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const src = snap.history[snap.historyStep];
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      if (token !== restoreTokenRef.current) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (snap.isTyping && snap.textPosition) {
        try {
          baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          baseImageDataRef.current = null;
        }
        setIsTyping(true);
      }
    };
    img.src = src;
  };

  const finishStrokeIfNeeded = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    saveToHistory();
  };

  const selectTab = (id) => {
    if (id === activeId) return;
    finishStrokeIfNeeded();
    snapshotsRef.current.set(activeId, captureSnapshot());
    setActiveId(id);
    const snap = snapshotsRef.current.get(id);
    if (snap) restoreSnapshot(snap);
    else resetCanvasToBlank();
  };

  const addTab = () => {
    if (tabs.length >= MAX_TABS) return;
    finishStrokeIfNeeded();
    snapshotsRef.current.set(activeId, captureSnapshot());
    nameCounterRef.current += 1;
    const tab = createTab(`Aba ${nameCounterRef.current}`);
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    resetCanvasToBlank();
  };

  const closeTab = (id, event) => {
    event.stopPropagation();
    if (tabs.length <= 1) return;

    snapshotsRef.current.delete(id);
    const index = tabs.findIndex((tab) => tab.id === id);
    const nextTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(nextTabs);

    if (editingId === id) setEditingId(null);

    if (id !== activeId) return;

    const neighbor = nextTabs[Math.min(index, nextTabs.length - 1)];
    setActiveId(neighbor.id);
    const snap = snapshotsRef.current.get(neighbor.id);
    if (snap) restoreSnapshot(snap);
    else resetCanvasToBlank();
  };

  const beginRename = (tab) => {
    setEditingId(tab.id);
    setNameDraft(tab.name);
  };

  const commitRename = () => {
    if (skipRenameCommitRef.current) {
      skipRenameCommitRef.current = false;
      return;
    }
    const id = editingId;
    const nextName = nameDraft.trim();
    if (id && nextName) {
      setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, name: nextName.slice(0, 24) } : tab)));
    }
    setEditingId(null);
  };

  const toggleTheme = () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
  };

  const undo = () => {
    if (isTyping) return;
    if (historyStepRef.current > 0) {
      const next = historyStepRef.current - 1;
      historyStepRef.current = next;
      setHistoryStep(next);
      restoreFromHistory(next);
    }
  };

  const redo = () => {
    if (isTyping) return;
    if (historyStepRef.current < historyRef.current.length - 1) {
      const next = historyStepRef.current + 1;
      historyStepRef.current = next;
      setHistoryStep(next);
      restoreFromHistory(next);
    }
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === 'text') {
      const ctx = canvas.getContext('2d');

      const beginTypingAt = () => {
        try {
          baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          baseImageDataRef.current = null;
        }
        ctx.globalCompositeOperation = 'source-over';
        setTextPosition({ x, y });
        setTextInput('');
        setIsTyping(true);
      };

      if (isTyping) {
        if (baseImageDataRef.current) {
          ctx.putImageData(baseImageDataRef.current, 0, 0);
          baseImageDataRef.current = null;
          setTextInput('');
          setTextPosition(null);
          setIsTyping(false);
          beginTypingAt();
        } else if (historyStep >= 0) {
          restoreFromHistory(historyStep, () => {
            beginTypingAt();
          });
        } else {
          setTextInput('');
          setTextPosition(null);
          setIsTyping(false);
          beginTypingAt();
        }
        return;
      }

      beginTypingAt();
      return;
    }

    isDrawingRef.current = true;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = lineWidth * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      saveToHistory();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsTyping(false);
    setTextPosition(null);
    setTextInput('');
    baseImageDataRef.current = null;
    saveToHistory();
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const safeName = (activeTab?.name || 'desenho').replace(/[^\w\s-]/g, '').trim() || 'desenho';
    link.download = `${safeName}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="drawing-editor">
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
                      skipRenameCommitRef.current = true;
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
            disabled={tabs.length >= MAX_TABS}
            title={tabs.length >= MAX_TABS ? 'Máximo de 3 abas' : 'Nova aba'}
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          type="button"
          className="tool-button theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="drawing-toolbar">
        <div className="tools-row">
          <button
            onClick={() => setTool('pen')}
            className={`tool-button ${tool === 'pen' ? 'active' : ''}`}
            title="Caneta"
          >
            <Pencil size={20} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`tool-button ${tool === 'eraser' ? 'active' : ''}`}
            title="Borracha"
          >
            <Eraser size={20} />
          </button>
          <button
            onClick={() => setTool('text')}
            className={`tool-button ${tool === 'text' ? 'active' : ''}`}
            title="Texto"
          >
            <Type size={20} />
          </button>

          <div className="tool-divider"></div>

          <button onClick={undo} className="tool-button" title="Desfazer" disabled={isTyping || historyStep <= 0}>
            <Undo size={20} />
          </button>
          <button onClick={redo} className="tool-button" title="Refazer" disabled={isTyping || historyStep >= history.length - 1}>
            <Redo size={20} />
          </button>
          <button onClick={clearCanvas} className="button-clear" title="Limpar">
            <Trash2 size={20} />
          </button>
          <button onClick={downloadImage} className="button-download" title="Baixar">
            <Download size={20} />
          </button>
        </div>

        <div className="settings-row">
          {tool !== 'text' && (
            <div className="setting-group">
              <label className="setting-label">Espessura:</label>
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
              <label className="setting-label">Tamanho:</label>
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
            <label className="setting-label">Cor:</label>
            <div className="color-swatches">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`color-swatch ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="color-input"
                title="Escolher cor personalizada"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="canvas-element"
        />
      </div>

      {isTyping && (
        <div className="typing-instructions">
          <p>Digite o texto | <strong>Enter</strong> para confirmar | <strong>Esc</strong> para cancelar</p>
        </div>
      )}
    </div>
  );
}
