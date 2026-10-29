'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Type, Eraser, Trash2, Download, Undo, Redo, Plus, X, Sun, Moon, Move, MousePointer2 } from 'lucide-react';
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
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = document.documentElement.dataset.theme;
    if (stored === 'dark' || stored === 'light') return stored;
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [shapeColor, setShapeColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [shapeType, setShapeType] = useState('rectangle');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isZoomEditing, setIsZoomEditing] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState(String(Math.round(zoom * 100)));

  const shellRef = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef(null);
  const shapeStartRef = useRef(null);
  const currentStrokeRef = useRef(null);
  const currentShapeRef = useRef(null);
  const dragSelectionRef = useRef(null);
  const resizeSelectionRef = useRef(null);
  const objectsRef = useRef([]);
  const selectionClearTimeoutRef = useRef(null);

  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [selectionInfo, setSelectionInfo] = useState({ object: null, bounds: null });
  const editingTextObjectIdRef = useRef(null);

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFFFFF'];

  const activeTab = tabs.find((tab) => tab.id === activeId) || tabs[0];
  const selectedTextObject = selectionInfo.object?.type === 'text' ? selectionInfo.object : null;

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const clampZoom = (value) => Math.min(4, Math.max(0.5, Number(value.toFixed(2))));

  const clampPanValue = (value, nextZoom = zoom) => {
    const shell = shellRef.current;
    if (!shell) return value;

    const canvasWidth = canvasRef.current?.width || 2400;
    const canvasHeight = canvasRef.current?.height || 1600;
    const stageWidth = canvasWidth * nextZoom;
    const stageHeight = canvasHeight * nextZoom;
    const maxX = Math.max(0, (stageWidth - shell.clientWidth) / 2);
    const maxY = Math.max(0, (stageHeight - shell.clientHeight) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, Number(value.x) || 0)),
      y: Math.min(maxY, Math.max(-maxY, Number(value.y) || 0)),
    };
  };

  const drawShape = useCallback((ctx, startPoint, endPoint, type) => {
    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;
    const width = endX - startX;
    const height = endY - startY;

    ctx.strokeStyle = shapeColor;
    ctx.fillStyle = shapeColor;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (type === 'rectangle') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(width);
      const h = Math.abs(height);
      ctx.strokeRect(x, y, w, h);
      return;
    }

    if (type === 'ellipse') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(width);
      const h = Math.abs(height);
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (type === 'line') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      return;
    }

    if (type === 'parametric') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(width);
      const h = Math.abs(height);
      ctx.beginPath();
      ctx.moveTo(x + 18, y);
      ctx.lineTo(x + w - 18, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + 18);
      ctx.lineTo(x + w, y + h - 18);
      ctx.quadraticCurveTo(x + w, y + h, x + w - 18, y + h);
      ctx.lineTo(x + 18, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - 18);
      ctx.lineTo(x, y + 18);
      ctx.quadraticCurveTo(x, y, x + 18, y);
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (type === 'square') {
      const size = Math.max(Math.abs(width), Math.abs(height));
      const x = startX <= endX ? startX : startX - size;
      const y = startY <= endY ? startY : startY - size;
      ctx.strokeRect(x, y, size, size);
      return;
    }

    if (type === 'outline-rectangle') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(width);
      const h = Math.abs(height);
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(x + 15, y);
      ctx.lineTo(x + w - 15, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + 15);
      ctx.lineTo(x + w, y + h - 15);
      ctx.quadraticCurveTo(x + w, y + h, x + w - 15, y + h);
      ctx.lineTo(x + 15, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - 15);
      ctx.lineTo(x, y + 15);
      ctx.quadraticCurveTo(x, y, x + 15, y);
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (type === 'diamond') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(width);
      const h = Math.abs(height);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (type === 'arrow') {
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLength = Math.min(24, Math.max(12, Math.abs(width) * 0.25 + Math.abs(height) * 0.25));

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6),
        endY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6),
        endY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }
  }, [lineWidth, shapeColor]);

  const renderObject = useCallback((ctx, obj) => {
    if (!obj) return;

    if (obj.type === 'stroke') {
      if (!obj.points || obj.points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x, obj.points[0].y);
      for (let i = 1; i < obj.points.length; i += 1) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
      }
      ctx.strokeStyle = obj.mode === 'eraser' ? '#000000' : obj.color;
      ctx.lineWidth = obj.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (obj.mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }

    if (obj.type === 'shape') {
      const prevStrokeStyle = ctx.strokeStyle;
      const prevFillStyle = ctx.fillStyle;
      const prevLineWidth = ctx.lineWidth;
      const prevLineJoin = ctx.lineJoin;
      const prevLineCap = ctx.lineCap;
      ctx.strokeStyle = obj.color;
      ctx.fillStyle = obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      drawShape(ctx, obj.start, obj.end, obj.shapeType);
      ctx.strokeStyle = prevStrokeStyle;
      ctx.fillStyle = prevFillStyle;
      ctx.lineWidth = prevLineWidth;
      ctx.lineJoin = prevLineJoin;
      ctx.lineCap = prevLineCap;
      return;
    }

    if (obj.type === 'text') {
      ctx.font = `${obj.fontSize}px Arial`;
      ctx.fillStyle = obj.color;
      ctx.fillText(obj.text, obj.x, obj.y);
    }
  }, [drawShape]);

  const getObjectBounds = useCallback((selected) => {
    if (!selected) return null;

    if (selected.type === 'text') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      return {
        x: selected.x,
        y: selected.y - selected.fontSize,
        width: ctx ? ctx.measureText(selected.text).width : 80,
        height: selected.fontSize + 8,
      };
    }

    if (selected.type === 'shape') {
      return {
        x: Math.min(selected.start.x, selected.end.x),
        y: Math.min(selected.start.y, selected.end.y),
        width: Math.abs(selected.end.x - selected.start.x),
        height: Math.abs(selected.end.y - selected.start.y),
      };
    }

    return null;
  }, []);

  const renderCanvasFromObjects = useCallback((excludedIds = []) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = canvas.width;
    baseCanvas.height = canvas.height;
    const baseCtx = baseCanvas.getContext('2d');
    baseCtx.clearRect(0, 0, canvas.width, canvas.height);
    baseCtx.fillStyle = '#FFFFFF';
    baseCtx.fillRect(0, 0, canvas.width, canvas.height);

    const eraserCanvas = document.createElement('canvas');
    eraserCanvas.width = canvas.width;
    eraserCanvas.height = canvas.height;
    const eraserCtx = eraserCanvas.getContext('2d');

    for (const item of objectsRef.current) {
      if (excludedIds.includes(item.id)) continue;
      if (item.type === 'stroke' && item.mode === 'eraser') {
        renderObject(eraserCtx, item);
      } else {
        renderObject(baseCtx, item);
      }
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.drawImage(eraserCanvas, 0, 0);

    const selected = objectsRef.current.find((item) => item.id === selectedObjectId && !excludedIds.includes(item.id));
    if (!selected) return;

    const bounds = getObjectBounds(selected);
    if (!bounds) return;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(bounds.x - 8, bounds.y - 8, bounds.width + 16, bounds.height + 16);
    ctx.setLineDash([]);
  }, [getObjectBounds, renderObject, selectedObjectId]);

  const renderAllObjects = useCallback(() => {
    renderCanvasFromObjects();
  }, [renderCanvasFromObjects]);

  const moveObject = (obj, dx, dy) => {
    if (!obj) return;
    if (obj.type === 'text') {
      obj.x += dx;
      obj.y += dy;
      return;
    }

    if (obj.type === 'shape') {
      obj.start.x += dx;
      obj.start.y += dy;
      obj.end.x += dx;
      obj.end.y += dy;
      return;
    }

    if (obj.type === 'stroke') {
      obj.points = obj.points.map((point) => ({
        x: point.x + dx,
        y: point.y + dy,
      }));
    }
  };

  const resizeObjectByHandle = (obj, handle, dx, dy, startBounds, startObject) => {
    if (!obj || !startBounds) return;

    const nextLeft = handle.includes('w') ? startBounds.x + dx : startBounds.x;
    const nextTop = handle.includes('n') ? startBounds.y + dy : startBounds.y;
    const nextRight = handle.includes('e') ? startBounds.x + startBounds.width + dx : startBounds.x + startBounds.width;
    const nextBottom = handle.includes('s') ? startBounds.y + startBounds.height + dy : startBounds.y + startBounds.height;

    const left = Math.min(nextLeft, nextRight);
    const top = Math.min(nextTop, nextBottom);
    const right = Math.max(nextLeft, nextRight);
    const bottom = Math.max(nextTop, nextBottom);

    if (obj.type === 'shape') {
      obj.start = { x: left, y: top };
      obj.end = { x: right, y: bottom };
      return;
    }

    if (obj.type === 'text') {
      return;
    }
  };

  const findObjectAtPoint = (x, y) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return null;

    const textHits = [];
    const shapeHits = [];

    for (let i = objectsRef.current.length - 1; i >= 0; i -= 1) {
      const obj = objectsRef.current[i];

      if (obj.type === 'text') {
        const textWidth = ctx.measureText(obj.text).width;
        const left = obj.x;
        const right = obj.x + textWidth;
        const top = obj.y - obj.fontSize;
        const bottom = obj.y + 8;
        if (x >= left && x <= right && y >= top && y <= bottom) {
          textHits.push(obj);
        }
      }

      if (obj.type === 'shape') {
        const minX = Math.min(obj.start.x, obj.end.x);
        const maxX = Math.max(obj.start.x, obj.end.x);
        const minY = Math.min(obj.start.y, obj.end.y);
        const maxY = Math.max(obj.start.y, obj.end.y);
        const withinBounds = x >= minX && x <= maxX && y >= minY && y <= maxY;

        if (!withinBounds) continue;

        if (obj.shapeType === 'diamond') {
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const px = (x - cx) / ((maxX - minX) / 2 || 1);
          const py = (y - cy) / ((maxY - minY) / 2 || 1);
          if (Math.abs(px) + Math.abs(py) <= 1 + 0.15) {
            shapeHits.push(obj);
          }
          continue;
        }

        if (obj.shapeType === 'arrow') {
          const angle = Math.atan2(obj.end.y - obj.start.y, obj.end.x - obj.start.x);
          const dx = x - obj.start.x;
          const dy = y - obj.start.y;
          const projected = dx * Math.cos(-angle) + dy * Math.sin(-angle);
          const perpendicular = -dx * Math.sin(-angle) + dy * Math.cos(-angle);
          const headLength = Math.min(24, Math.max(12, Math.abs(obj.end.x - obj.start.x) * 0.25 + Math.abs(obj.end.y - obj.start.y) * 0.25));
          const lineLength = Math.hypot(obj.end.x - obj.start.x, obj.end.y - obj.start.y);
          if (projected >= 0 && projected <= lineLength && Math.abs(perpendicular) <= 10) {
            shapeHits.push(obj);
            continue;
          }
          const headStartX = obj.end.x - headLength * Math.cos(angle - Math.PI / 6);
          const headStartY = obj.end.y - headLength * Math.sin(angle - Math.PI / 6);
          const headEndX = obj.end.x - headLength * Math.cos(angle + Math.PI / 6);
          const headEndY = obj.end.y - headLength * Math.sin(angle + Math.PI / 6);
          const inHead = pointInTriangle(x, y, obj.end.x, obj.end.y, headStartX, headStartY, headEndX, headEndY);
          if (inHead) {
            shapeHits.push(obj);
          }
          continue;
        }

        shapeHits.push(obj);
      }
    }

    if (textHits.length > 0) return textHits[0];
    if (shapeHits.length > 0) return shapeHits[0];
    return null;
  };

  const pointInTriangle = (px, py, ax, ay, bx, by, cx, cy) => {
    const area = Math.abs((ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) / 2);
    const area1 = Math.abs((px * (by - cy) + bx * (cy - py) + cx * (py - by)) / 2);
    const area2 = Math.abs((ax * (py - cy) + px * (cy - ay) + cx * (ay - py)) / 2);
    const area3 = Math.abs((ax * (by - py) + bx * (py - ay) + px * (ay - by)) / 2);
    return Math.abs(area - (area1 + area2 + area3)) < 0.5;
  };

  const handleZoom = (nextZoom, clientX, clientY) => {
    const shell = shellRef.current;
    const nextValue = clampZoom(nextZoom);

    if (!shell) {
      setZoom(nextValue);
      return;
    }

    const rect = shell.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - pan.x) / zoom;
    const worldY = (localY - pan.y) / zoom;

    const nextPan = clampPanValue({
      x: localX - worldX * nextValue,
      y: localY - worldY * nextValue,
    }, nextValue);

    setPan(nextPan);
    setZoom(nextValue);
  };

  const stopPanning = () => {
    isPanningRef.current = false;
    panStartRef.current = null;
  };

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newHistory = historyRef.current.slice(0, historyStepRef.current + 1);
    newHistory.push(canvas.toDataURL());
    historyRef.current = newHistory;
    historyStepRef.current = newHistory.length - 1;
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, []);

  const restoreFromHistory = useCallback((step, cb) => {
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
  }, []);

  const clearSelectionState = useCallback(() => {
    if (selectionClearTimeoutRef.current) {
      clearTimeout(selectionClearTimeoutRef.current);
    }
    selectionClearTimeoutRef.current = setTimeout(() => {
      setSelectedObjectId(null);
      setSelectionInfo({ object: null, bounds: null });
    }, 100);
  }, []);

  const syncSelectedInfo = useCallback((id = selectedObjectId) => {
    const selected = id ? objectsRef.current.find((item) => item.id === id) : null;
    setSelectionInfo(
      selected
        ? { object: selected, bounds: getObjectBounds(selected) }
        : { object: null, bounds: null }
    );
  }, [getObjectBounds, selectedObjectId]);

  const setSelectedObject = useCallback((id) => {
    setSelectedObjectId(id);
    syncSelectedInfo(id);
  }, [syncSelectedInfo]);

  const removeObjectsInEraserRadius = useCallback((x, y) => {
    const radius = 16;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!ctx) return;

    const pointToSegmentDistance = (px, py, x1, y1, x2, y2) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      return Math.hypot(px - closestX, py - closestY);
    };

    let changed = false;
    const nextObjects = [];

    for (const obj of objectsRef.current) {
      if (obj.type === 'shape') {
        nextObjects.push(obj);
        continue;
      }

      if (obj.type === 'text') {
        const textWidth = ctx.measureText(obj.text).width;
        const left = obj.x - radius;
        const right = obj.x + textWidth + radius;
        const top = obj.y - obj.fontSize - radius;
        const bottom = obj.y + 8 + radius;
        const hit = x >= left && x <= right && y >= top && y <= bottom;
        if (!hit) {
          nextObjects.push(obj);
        } else {
          changed = true;
        }
        continue;
      }

      if (obj.type === 'stroke') {
        const hitStroke = obj.points.some((point, index) => {
          if (index === obj.points.length - 1) return false;
          const nextPoint = obj.points[index + 1];
          return pointToSegmentDistance(x, y, point.x, point.y, nextPoint.x, nextPoint.y) <= radius;
        });

        if (!hitStroke) {
          nextObjects.push(obj);
          continue;
        }

        changed = true;
      }
    }

    if (!changed) return;

    objectsRef.current = nextObjects;
    setSelectedObject(null);
    renderAllObjects();
    saveToHistory();
  }, [renderAllObjects, saveToHistory, setSelectedObject]);

  const deleteSelectedObject = useCallback(() => {
    if (!selectedObjectId) return;
    objectsRef.current = objectsRef.current.filter((item) => item.id !== selectedObjectId);
    setSelectedObject(null);
    renderAllObjects();
    saveToHistory();
  }, [renderAllObjects, saveToHistory, selectedObjectId, setSelectedObject]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const init = () => {
      const width = 2400;
      const height = 1600;
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
  }, [saveToHistory]);

  useEffect(() => {
    if (editingId && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    const renderTextTypingPreview = (nextValue) => {
      const canvas = canvasRef.current;
      if (!canvas || !textPosition) return;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (baseImageDataRef.current) {
        ctx.putImageData(baseImageDataRef.current, 0, 0);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = color;
      ctx.fillText(nextValue, textPosition.x, textPosition.y);

      const textWidth = ctx.measureText(nextValue || '').width;
      ctx.fillRect(textPosition.x + textWidth, textPosition.y - fontSize, 2, fontSize);
    };

    const syncTextDraftToObject = (nextValue) => {
      const targetId = editingTextObjectIdRef.current;
      if (!targetId) return;
      const target = objectsRef.current.find((item) => item.id === targetId);
      if (target && target.type === 'text') {
        target.text = nextValue;
        target.x = textPosition.x;
        target.y = textPosition.y;
        target.fontSize = fontSize;
        target.color = color;
        setSelectedObject(targetId);
      }
    };

    const updateTextDraft = (getNextValue) => {
      setTextInput((prev) => {
        const nextValue = getNextValue(prev);
        syncTextDraftToObject(nextValue);
        renderTextTypingPreview(nextValue);
        return nextValue;
      });
    };

    const handleKeyPress = (e) => {
      if (isTyping && textPosition) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const canvas = canvasRef.current;
          const targetId = editingTextObjectIdRef.current;
          const finalize = () => {
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx.font = `${fontSize}px Arial`;
              ctx.fillStyle = color;
              ctx.fillText(textInput, textPosition.x, textPosition.y);
            }

            if (targetId) {
              const target = objectsRef.current.find((item) => item.id === targetId);
              if (target && target.type === 'text') {
                target.text = textInput;
                target.x = textPosition.x;
                target.y = textPosition.y;
                target.fontSize = fontSize;
                target.color = color;
                setSelectedObject(targetId);
              }
            } else {
              objectsRef.current.push({
                id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'text',
                text: textInput,
                x: textPosition.x,
                y: textPosition.y,
                fontSize,
                color,
              });
              setSelectedObject(null);
              clearSelectionState();
            }

            setIsTyping(false);
            setTextPosition(null);
            setTextInput('');
            editingTextObjectIdRef.current = null;
            baseImageDataRef.current = null;
            renderAllObjects();
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
          updateTextDraft((prev) => prev.slice(0, -1));
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
          editingTextObjectIdRef.current = null;
          setIsTyping(false);
          setTextPosition(null);
          setTextInput('');
          baseImageDataRef.current = null;
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          updateTextDraft((prev) => `${prev}${e.key}`);
        }
      }
    };

    if (isTyping) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [isTyping, textPosition, textInput, historyStep, fontSize, color, renderAllObjects, restoreFromHistory, saveToHistory, clearSelectionState, setSelectedObject]);

  const captureSnapshot = () => ({
    history: historyRef.current.slice(),
    historyStep: historyStepRef.current,
    isTyping,
    textInput,
    textPosition: textPosition ? { ...textPosition } : null,
    tool,
    color,
    shapeColor,
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
    objectsRef.current = [];
    setSelectedObjectId(null);
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
    setColor(snap.color ?? '#000000');
    setShapeColor(snap.shapeColor ?? snap.color ?? '#000000');
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
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
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

  const beginEditingTextObject = useCallback((obj) => {
    if (!obj || obj.type !== 'text') return;
    const canvas = canvasRef.current;
    if (canvas) {
      renderCanvasFromObjects([obj.id]);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    }
    editingTextObjectIdRef.current = obj.id;
    setSelectedObject(obj.id);
    setTextInput(obj.text);
    setTextPosition({ x: obj.x, y: obj.y });
    setIsTyping(true);
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas || !obj) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(baseImageDataRef.current, 0, 0);
        ctx.font = `${obj.fontSize}px Arial`;
        ctx.fillStyle = obj.color;
        ctx.fillText(obj.text, obj.x, obj.y);
      }
    });
  }, [renderCanvasFromObjects, setSelectedObject]);

  const startDrawing = (e) => {
    if (tool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    const canvas = canvasRef.current;
    const { x, y } = getCanvasPoint(e);

    if (tool === 'select') {
      const handle = e.target?.dataset?.resizeHandle;
      if (handle && selectedObjectId) {
        const selected = objectsRef.current.find((item) => item.id === selectedObjectId);
        resizeSelectionRef.current = {
          objectId: selectedObjectId,
          handle,
          startX: x,
          startY: y,
          startBounds: selectionInfo.bounds ? { ...selectionInfo.bounds } : getObjectBounds(selected),
          startObject: selected ? { ...selected } : null,
        };
        return;
      }

      const hit = findObjectAtPoint(x, y);
      setSelectedObject(hit ? hit.id : null);
      if (hit) {
        dragSelectionRef.current = {
          objectId: hit.id,
          startX: x,
          startY: y,
        };
      }
      return;
    }

    if (tool === 'shape') {
      shapeStartRef.current = { x, y };
      currentShapeRef.current = { start: { x, y }, end: { x, y } };
      isDrawingRef.current = true;
      const ctx = canvas.getContext('2d');
      if (baseImageDataRef.current) {
        ctx.putImageData(baseImageDataRef.current, 0, 0);
      }
      baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return;
    }

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
    currentStrokeRef.current = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'stroke',
      mode: tool,
      width: tool === 'eraser' ? 16 : lineWidth,
      color,
      points: [{ x, y }],
    };
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (tool === 'pan') {
      if (!isPanningRef.current || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const nextPan = clampPanValue({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      }, zoom);
      setPan(nextPan);
      return;
    }

    if (tool === 'select') {
      if (resizeSelectionRef.current) {
        const { startX, startY, objectId, handle, startBounds, startObject } = resizeSelectionRef.current;
        const { x, y } = getCanvasPoint(e);
        const dx = x - startX;
        const dy = y - startY;
        const selected = objectsRef.current.find((item) => item.id === objectId);
        if (selected) {
          resizeObjectByHandle(selected, handle, dx, dy, startBounds, startObject);
          renderAllObjects();
          syncSelectedInfo(objectId);
        }
        return;
      }

      if (!dragSelectionRef.current) return;
      const { startX, startY, objectId } = dragSelectionRef.current;
      const { x, y } = getCanvasPoint(e);
      const dx = x - startX;
      const dy = y - startY;
      const selected = objectsRef.current.find((item) => item.id === objectId);
      if (selected) {
        moveObject(selected, dx, dy);
        dragSelectionRef.current = { objectId, startX: x, startY: y };
        renderAllObjects();
        syncSelectedInfo(objectId);
      }
      return;
    }

    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasPoint(e);

    if (tool === 'shape') {
      if (!shapeStartRef.current) return;
      if (baseImageDataRef.current) {
        ctx.putImageData(baseImageDataRef.current, 0, 0);
      }
      currentShapeRef.current = { start: shapeStartRef.current, end: { x, y } };
      drawShape(ctx, shapeStartRef.current, { x, y }, shapeType);
      return;
    }

    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push({ x, y });
    }

    if (tool === 'eraser') {
      removeObjectsInEraserRadius(x, y);
      return;
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      if (tool === 'eraser') {
        currentStrokeRef.current = null;
        isDrawingRef.current = false;
        return;
      }

      if (tool === 'shape' && shapeStartRef.current && currentShapeRef.current) {
        objectsRef.current.push({
          id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'shape',
          shapeType,
          start: { ...shapeStartRef.current },
          end: { ...currentShapeRef.current.end },
          color: shapeColor,
          lineWidth,
        });
        setSelectedObject(null);
        clearSelectionState();
        renderAllObjects();
      }

      if (tool === 'pen' && currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
        objectsRef.current.push({
          ...currentStrokeRef.current,
          id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        });
        setSelectedObject(null);
        clearSelectionState();
        renderAllObjects();
      }

      isDrawingRef.current = false;
      shapeStartRef.current = null;
      currentShapeRef.current = null;
      currentStrokeRef.current = null;
      baseImageDataRef.current = null;
      saveToHistory();
    }

    if (dragSelectionRef.current) {
      saveToHistory();
      dragSelectionRef.current = null;
    }

    if (resizeSelectionRef.current) {
      saveToHistory();
      resizeSelectionRef.current = null;
    }

    if (isPanningRef.current) {
      stopPanning();
    }
  };

  const handleWheelZoom = (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    handleZoom(zoom + delta, event.clientX, event.clientY);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    objectsRef.current = [];
    setSelectedObjectId(null);
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
                  onClick={() => {
                    if (tool === 'shape') {
                      setShapeColor(c);
                    } else {
                      setColor(c);
                    }
                  }}
                  className={`color-swatch ${(tool === 'shape' ? shapeColor : color) === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={`Selecionar cor ${c}`}
                />
              ))}
              <input
                type="color"
                value={tool === 'shape' ? shapeColor : color}
                onChange={(e) => {
                  if (tool === 'shape') {
                    setShapeColor(e.target.value);
                  } else {
                    setColor(e.target.value);
                  }
                }}
                className="color-input"
                title="Escolher cor personalizada"
                aria-label="Escolher cor personalizada"
              />
            </div>
          </div>
        </div>

   
      </div>

      <div className="canvas-container">
        <div
          ref={shellRef}
          className="canvas-shell"
          onWheel={handleWheelZoom}
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
            onChange={(event) => {
              setZoomInputValue(event.target.value);
            }}
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

      {isTyping && (
        <div className="typing-instructions">
          <p>Digite o texto | <strong>Enter</strong> para confirmar | <strong>Esc</strong> para cancelar</p>
        </div>
      )}
    </div>
  );
}
