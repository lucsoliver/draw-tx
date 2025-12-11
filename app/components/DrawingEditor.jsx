'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Type, Eraser, Trash2, Download, Undo, Redo } from 'lucide-react';
import './DrawingEditor.css';

export default function DrawingTextEditor() {
  const canvasRef = useRef(null);
  const baseImageDataRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveToHistory();
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isTyping && textPosition) {
        e.preventDefault();
        
        if (e.key === 'Enter') {
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
          setTextInput(prev => prev.slice(0, -1));
        } else if (e.key === 'Escape') {
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
          setTextInput(prev => prev + e.key);
        }
      }
    };

    if (isTyping) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [isTyping, textPosition, textInput, historyStep, fontSize, color]);

  useEffect(() => {
    if (isTyping && textPosition) {
      requestAnimationFrame(() => {
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

        const textWidth = ctx.measureText(textInput).width;
        ctx.fillRect(textPosition.x + textWidth, textPosition.y - fontSize, 2, fontSize);
      });
    }
  }, [textInput, isTyping, textPosition, color, fontSize, historyStep]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(canvas.toDataURL());
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
    }
  };

  const restoreFromHistory = (step, cb) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      if (cb) cb();
      return;
    }
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = history[step];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (cb) cb();
    };
    img.onerror = () => {
      if (cb) cb();
    };
  };

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      restoreFromHistory(historyStep - 1);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      restoreFromHistory(historyStep + 1);
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
        } catch (err) {
          baseImageDataRef.current = null;
        }
        ctx.globalCompositeOperation = 'source-over';
        saveToHistory();
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

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;

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
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  const addText = () => {
    if (!textInput || !textPosition) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const doFinalize = () => {
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = color;
      ctx.fillText(textInput, textPosition.x, textPosition.y);

      setTextInput('');
      setTextPosition(null);
      setIsTyping(false);
      baseImageDataRef.current = null;
      saveToHistory();
    };

    if (baseImageDataRef.current) {
      const ctx = canvas.getContext('2d');
      ctx.putImageData(baseImageDataRef.current, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      doFinalize();
    } else if (historyStep >= 0) {
      restoreFromHistory(historyStep, () => {
        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over';
        doFinalize();
      });
    } else {
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = 'source-over';
      doFinalize();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'desenho.png';
    link.href = url;
    link.click();
  };

  return (
    <div className="drawing-editor">
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

          <button onClick={undo} className="tool-button" title="Desfazer">
            <Undo size={20} />
          </button>
          <button onClick={redo} className="tool-button" title="Refazer">
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