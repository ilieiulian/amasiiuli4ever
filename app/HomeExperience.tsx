"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Month = {
  id: string;
  name: string;
  accent: string;
  doorTextureMonthlyPng: string;
};

type PublicDrawing = {
  imageUrl: string;
  message: string;
  updatedAt: string;
};

const MONTH_NAMES = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
] as const;

const MONTH_TEXTURE_FILES = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
] as const;

const MONTH_ACCENTS = [
  "#cd6a4b", "#b84c67", "#6f8e67", "#9b7359", "#b57a8d", "#c28b3e",
  "#c9643e", "#a75b3c", "#717f5d", "#9d5f3d", "#746175", "#486e65",
] as const;

function buildCompletedMonths(now: Date): Month[] {
  const result: Month[] = [];
  const cursor = new Date(2025, 2, 1);
  const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  while (cursor <= lastCompletedMonth) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const monthNumber = String(monthIndex + 1).padStart(2, "0");
    const accent = MONTH_ACCENTS[monthIndex];
    result.push({
      id: `${year}-${monthNumber}`,
      name: `${MONTH_NAMES[monthIndex]} ${year}`,
      accent,
      doorTextureMonthlyPng: `/texturi/usi/${MONTH_TEXTURE_FILES[monthIndex]}.png`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

function InsideArtwork({
  drawing,
  label,
}: {
  drawing?: string;
  label: string;
}) {
  return (
    <span className="inside-artwork" role="img" aria-label={label}>
      {drawing ? (
        <span
          className="saved-art"
          style={{ backgroundImage: `url(${drawing})` }}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}

function DoorPanels() {
  return (
    <span className="door-layer" aria-hidden="true">
      <span className="door-half door-half--left" />
      <span className="door-half door-half--right" />
    </span>
  );
}

function MonthCard({
  month,
  drawing,
  onOpen,
}: {
  month: Month;
  drawing?: string;
  onOpen: () => void;
}) {
  const cardStyle = {
    "--month-accent": month.accent,
    "--door-texture-monthly-png": `url("${month.doorTextureMonthlyPng}")`,
  } as CSSProperties;

  return (
    <button
      className="month-card"
      style={cardStyle}
      type="button"
      onClick={onOpen}
      aria-label={`Deschide luna ${month.name} în atelierul de desen`}
      aria-haspopup="dialog"
    >
      <span className="month-square">
        <InsideArtwork
          drawing={drawing}
          label={drawing ? `Desen salvat pentru ${month.name}` : `Interior gol pentru ${month.name}`}
        />
        <DoorPanels />
      </span>
      <span className="month-meta">
        <span className="month-name">{month.name}</span>
        <span className="month-state">{drawing ? "desen salvat" : "de desenat"}</span>
      </span>
    </button>
  );
}

type DrawingTool =
  | "brush"
  | "pencil"
  | "marker"
  | "spray"
  | "eraser"
  | "fill"
  | "eyedropper";

type CanvasPoint = { x: number; y: number; scale: number };

const DRAWING_TOOLS: ReadonlyArray<{
  id: DrawingTool;
  label: string;
  icon: string;
}> = [
  { id: "brush", label: "Pensulă", icon: "✎" },
  { id: "pencil", label: "Creion", icon: "✐" },
  { id: "marker", label: "Marker", icon: "▰" },
  { id: "spray", label: "Spray", icon: "⁙" },
  { id: "eraser", label: "Gumă", icon: "◇" },
  { id: "fill", label: "Umplere", icon: "▧" },
  { id: "eyedropper", label: "Pipetă", icon: "◉" },
];

const FREEHAND_TOOLS = new Set<DrawingTool>([
  "brush",
  "pencil",
  "marker",
  "spray",
  "eraser",
]);

function DrawingStudio({
  month,
  initialDrawing,
  initialMessage,
  publicationCode,
  onPublicationCodeChange,
  onSave,
}: {
  month: Month;
  initialDrawing?: string;
  initialMessage?: string;
  publicationCode: string;
  onPublicationCodeChange: (value: string) => void;
  onSave: (image: Blob, message: string, code: string) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const [activeTool, setActiveTool] = useState<DrawingTool>("brush");
  const [color, setColor] = useState("#8f3d4f");
  const [brushSize, setBrushSize] = useState(12);
  const [opacity, setOpacity] = useState(100);
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const [importedFileName, setImportedFileName] = useState("");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");

  const syncHistoryState = () => {
    setHistoryState({
      undo: historyRef.current.length > 0,
      redo: redoRef.current.length > 0,
    });
  };

  const resetContext = (context: CanvasRenderingContext2D) => {
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.setLineDash([]);
  };

  const restoreSnapshot = (snapshot?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    resetContext(context);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!snapshot) return;

    const image = new Image();
    image.onload = () => {
      resetContext(context);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = snapshot;
  };

  const recordSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyRef.current.push(canvas.toDataURL("image/png"));
    if (historyRef.current.length > 24) historyRef.current.shift();
    redoRef.current = [];
    syncHistoryState();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 600;
    canvas.height = 600;
    restoreSnapshot(initialDrawing);
    // The studio remounts for every selected month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>): CanvasPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, scale: 1 };
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
      scale: canvas.width / bounds.width,
    };
  };

  const configureTool = (
    context: CanvasRenderingContext2D,
    point: CanvasPoint,
    tool: DrawingTool,
  ) => {
    resetContext(context);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
    context.fillStyle = color;

    if (tool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.lineWidth = brushSize * point.scale;
      return;
    }

    context.globalAlpha = opacity / 100;
    if (tool === "pencil") {
      context.lineWidth = Math.max(1, brushSize * 0.3 * point.scale);
    } else if (tool === "marker") {
      context.globalAlpha *= 0.3;
      context.lineWidth = brushSize * 2.2 * point.scale;
    } else {
      context.lineWidth = brushSize * point.scale;
    }
  };

  const drawSpray = (context: CanvasRenderingContext2D, point: CanvasPoint) => {
    configureTool(context, point, "spray");
    const radius = Math.max(4, brushSize * 1.55 * point.scale);
    const dots = Math.max(12, Math.round(brushSize * 1.6));
    const dotSize = Math.max(1, point.scale * 0.85);
    for (let index = 0; index < dots; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius;
      context.fillRect(
        point.x + Math.cos(angle) * distance,
        point.y + Math.sin(angle) * distance,
        dotSize,
        dotSize,
      );
    }
    resetContext(context);
  };

  const hexToRgba = (hex: string, alphaValue: number) => {
    const normalized = hex.replace("#", "");
    return {
      red: Number.parseInt(normalized.slice(0, 2), 16),
      green: Number.parseInt(normalized.slice(2, 4), 16),
      blue: Number.parseInt(normalized.slice(4, 6), 16),
      alpha: Math.round(alphaValue * 2.55),
    };
  };

  const floodFill = (context: CanvasRenderingContext2D, point: CanvasPoint) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const startX = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
    const startY = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
    const startIndex = (startY * canvas.width + startX) * 4;
    const target = [data[startIndex], data[startIndex + 1], data[startIndex + 2], data[startIndex + 3]];
    const replacement = hexToRgba(color, opacity);

    if (
      target[0] === replacement.red &&
      target[1] === replacement.green &&
      target[2] === replacement.blue &&
      target[3] === replacement.alpha
    ) return;

    const matchesTarget = (index: number) =>
      data[index] === target[0] &&
      data[index + 1] === target[1] &&
      data[index + 2] === target[2] &&
      data[index + 3] === target[3];
    const stack: number[] = [];
    const paintAndQueue = (index: number) => {
      data[index] = replacement.red;
      data[index + 1] = replacement.green;
      data[index + 2] = replacement.blue;
      data[index + 3] = replacement.alpha;
      stack.push(index);
    };

    paintAndQueue(startIndex);
    while (stack.length > 0) {
      const index = stack.pop();
      if (index === undefined) break;
      const pixel = index / 4;
      const pixelX = pixel % canvas.width;
      const neighbors = [
        pixelX > 0 ? index - 4 : -1,
        pixelX < canvas.width - 1 ? index + 4 : -1,
        pixel >= canvas.width ? index - canvas.width * 4 : -1,
        pixel < canvas.width * (canvas.height - 1) ? index + canvas.width * 4 : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && matchesTarget(neighbor)) paintAndQueue(neighbor);
      }
    }
    context.putImageData(imageData, 0, 0);
  };

  const sampleColor = (context: CanvasRenderingContext2D, point: CanvasPoint) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
    const sampleY = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
    const pixel = context.getImageData(sampleX, sampleY, 1, 1).data;
    if (pixel[3] === 0) {
      setSaveFeedback("Zona aleasă este transparentă. Alege un punct colorat.");
      return;
    }
    const pickedColor = `#${[pixel[0], pixel[1], pixel[2]]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}`;
    setColor(pickedColor);
    setOpacity(Math.max(1, Math.round((pixel[3] / 255) * 100)));
    setActiveTool("brush");
    setSaveFeedback(`Culoarea ${pickedColor.toUpperCase()} a fost aleasă.`);
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getCanvasPoint(event);

    if (activeTool === "eyedropper") {
      sampleColor(context, point);
      return;
    }

    recordSnapshot();
    if (activeTool === "fill") {
      floodFill(context, point);
      setSaved(false);
      return;
    }

    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    if (activeTool === "spray") {
      drawSpray(context, point);
      return;
    }

    configureTool(context, point, activeTool);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getCanvasPoint(event);

    if (activeTool === "spray") {
      drawSpray(context, point);
    } else if (FREEHAND_TOOLS.has(activeTool)) {
      context.lineTo(point.x, point.y);
      context.stroke();
    }
  };

  const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !isDrawingRef.current) return;
    const point = getCanvasPoint(event);

    if (activeTool === "spray") {
      drawSpray(context, point);
    } else {
      context.lineTo(point.x, point.y);
      context.stroke();
      context.closePath();
    }

    resetContext(context);
    isDrawingRef.current = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    setSaved(false);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const snapshot = historyRef.current.pop();
    if (!canvas || !snapshot) return;
    redoRef.current.push(canvas.toDataURL("image/png"));
    restoreSnapshot(snapshot);
    syncHistoryState();
    setSaved(false);
  };

  const redo = () => {
    const canvas = canvasRef.current;
    const snapshot = redoRef.current.pop();
    if (!canvas || !snapshot) return;
    historyRef.current.push(canvas.toDataURL("image/png"));
    restoreSnapshot(snapshot);
    syncHistoryState();
    setSaved(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    recordSnapshot();
    resetContext(context);
    context.clearRect(0, 0, canvas.width, canvas.height);
    setImportedFileName("");
    setSaved(false);
  };

  const importImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSaveFeedback("Alege un fișier imagine.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setSaveFeedback("Imaginea este prea mare. Alege una de maximum 30 MB.");
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    recordSnapshot();
    const objectUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const scale = Math.min(
            canvas.width / image.naturalWidth,
            canvas.height / image.naturalHeight,
          );
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          const x = (canvas.width - width) / 2;
          const y = (canvas.height - height) / 2;

          resetContext(context);
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, x, y, width, height);
          resolve();
        };
        image.onerror = () => reject(new Error("Imaginea nu a putut fi deschisă."));
        image.src = objectUrl;
      });
      setImportedFileName(file.name);
      setActiveTool("brush");
      setSaved(false);
      setSaveFeedback("Imaginea a fost adăugată. Poți desena peste ea înainte de publicare.");
    } catch (error) {
      historyRef.current.pop();
      syncHistoryState();
      setSaveFeedback(
        error instanceof Error ? error.message : "Imaginea nu a putut fi adăugată.",
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const saveCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!publicationCode.trim()) {
      setSaveFeedback("Introdu codul de publicare.");
      return;
    }

    setSaving(true);
    setSaveFeedback("");
    try {
      const image = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Imaginea nu a putut fi pregătită."));
          },
          "image/webp",
          0.9,
        );
      });
      await onSave(image, message.trim(), publicationCode);
      setSaved(true);
      setSaveFeedback("Desenul și mesajul sunt acum publice.");
    } catch (error) {
      setSaved(false);
      setSaveFeedback(
        error instanceof Error ? error.message : "Desenul nu a putut fi salvat.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="studio" aria-label={`Atelier de desen pentru ${month.name}`}>
      <div className="studio-heading">
        <div>
          <p className="studio-kicker">Atelierul vostru</p>
          <h2>Creează luna {month.name}</h2>
        </div>
      </div>

      <div className="studio-body">
        <div className="studio-workbench">
          <div className="canvas-meta" aria-hidden="true">
            <span>Foaie de lucru</span>
            <span>{DRAWING_TOOLS.find((tool) => tool.id === activeTool)?.label} · {opacity}%</span>
          </div>
          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              className="drawing-canvas"
              aria-label={`Pânză de desen pentru luna ${month.name}`}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={(event) => {
                if (event.buttons === 0) stopDrawing(event);
              }}
            />
          </div>
        </div>

        <div className="studio-sidebar">
          <div className="studio-toolbox" aria-label="Instrumentele atelierului">
            <div className="toolbox-heading">
              <span>Trusa de desen</span>
              <span>compactă, dar completă</span>
            </div>

            <div className="tool-picker">
              <p className="tool-picker-label">Alege unealta</p>
              <div className="tool-grid">
                {DRAWING_TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    className={`tool-button${activeTool === tool.id ? " is-active" : ""}`}
                    type="button"
                    title={tool.label}
                    aria-label={`Unealta ${tool.label}`}
                    aria-pressed={activeTool === tool.id}
                    onClick={() => setActiveTool(tool.id)}
                  >
                    <span className="tool-icon" aria-hidden="true">{tool.icon}</span>
                    <span className="tool-label">{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="studio-controls">
              <label className="control control--color">
                <span>Culoare</span>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  aria-label="Alege culoarea"
                />
              </label>

              <label className="control control--range">
                <span>Mărime</span>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                  aria-label="Mărimea uneltei"
                />
                <output>{brushSize}px</output>
              </label>

              <label className="control control--opacity">
                <span>Opacitate</span>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={opacity}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                  aria-label="Opacitatea culorii"
                />
                <output>{opacity}%</output>
              </label>
            </div>


            <div className="tool-actions" aria-label="Istoric și curățare">
              <button className="history-button" type="button" onClick={undo} disabled={!historyState.undo}>
                <span aria-hidden="true">↶</span> Înapoi
              </button>
              <button className="history-button" type="button" onClick={redo} disabled={!historyState.redo}>
                <span aria-hidden="true">↷</span> Refă
              </button>
              <button className="history-button" type="button" onClick={clearCanvas}>
                <span aria-hidden="true">×</span> Șterge
              </button>
            </div>

            <div className="device-upload">
              <span className="device-upload-mark" aria-hidden="true">＋</span>
              <div className="device-upload-copy">
                <span className="device-upload-label">Imagine din dispozitiv</span>
                <span className="device-upload-status" aria-live="polite">
                  {importedFileName || "PNG, JPG sau WebP · maximum 30 MB"}
                </span>
              </div>
              <button
                className="import-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Alege imagine
              </button>
              <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={importImage}
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="publication-fields">
            <label className="publication-field">
              <span>Mesaj atașat (opțional)</span>
              <textarea
                value={message}
                maxLength={300}
                rows={3}
                placeholder="Scrie câteva cuvinte despre luna aceasta…"
                onChange={(event) => {
                  setMessage(event.target.value);
                  setSaved(false);
                }}
              />
              <small>{message.length}/300</small>
            </label>

            <label className="publication-field">
              <span>Cod de publicare</span>
              <input
                type="password"
                value={publicationCode}
                autoComplete="off"
                placeholder="Codul știut doar de voi doi"
                onChange={(event) => onPublicationCodeChange(event.target.value)}
              />
            </label>
          </div>

          <button
            className="save-button"
            type="button"
            onClick={saveCanvas}
            disabled={saving}
          >
            <span>
              {saving
                ? "Se publică…"
                : saved
                  ? "Salvat în calendar"
                  : `Publică în ${month.name}`}
            </span>
            <span aria-hidden="true">{saved ? "✓" : "→"}</span>
          </button>
          <p className="save-note" aria-live="polite">
            {saveFeedback ||
              "Imaginea publicată va fi vizibilă tuturor, pe orice dispozitiv."}
          </p>
        </div>
      </div>
    </section>
  );
}
function FocusModal({
  month,
  drawing,
  publicationCode,
  onPublicationCodeChange,
  onSave,
  onClose,
}: {
  month: Month;
  drawing?: PublicDrawing;
  publicationCode: string;
  onPublicationCodeChange: (value: string) => void;
  onSave: (image: Blob, message: string, code: string) => Promise<void>;
  onClose: () => void;
}) {
  const modalStyle = {
    "--month-accent": month.accent,
    "--door-texture-monthly-png": `url("${month.doorTextureMonthlyPng}")`,
  } as CSSProperties;

  return (
    <div
      className="focus-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="focus-shell" style={modalStyle}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Închide atelierul">
          <span aria-hidden="true">×</span>
        </button>

        <div className="focus-intro">
          <div className="focus-month">
            <div>
              <p>Capitolul nostru</p>
              <h2 id="focus-title">{month.name}</h2>
            </div>
          </div>

          <div className="focus-card" aria-hidden="true">
            <InsideArtwork
              drawing={drawing?.imageUrl}
              label={`Interiorul lunii ${month.name}`}
            />
            <DoorPanels />
          </div>

          {drawing?.message ? (
            <p className="drawing-message">{drawing.message}</p>
          ) : null}

          <p className="focus-caption">
            Desenează, adaugă o fotografie și păstrează luna aici.
          </p>
        </div>

        <DrawingStudio
          key={month.id}
          month={month}
          initialDrawing={drawing?.imageUrl}
          initialMessage={drawing?.message}
          publicationCode={publicationCode}
          onPublicationCodeChange={onPublicationCodeChange}
          onSave={onSave}
        />
      </div>
    </div>
  );
}
export default function HomeExperience() {
  const [drawings, setDrawings] = useState<Record<string, PublicDrawing>>({});
  const [activeMonthId, setActiveMonthId] = useState<string | null>(null);
  const [publicationCode, setPublicationCode] = useState("");
  const [months, setMonths] = useState<Month[]>(() => buildCompletedMonths(new Date()));

  useEffect(() => {
    let mounted = true;
    const loadDrawings = async () => {
      try {
        const response = await fetch("/api/drawings", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          drawings?: Record<string, PublicDrawing>;
        };
        if (mounted && payload.drawings) setDrawings(payload.drawings);
      } catch {
        // The canvas remains available if the network is temporarily unavailable.
      }
    };
    const handleFocus = () => void loadDrawings();

    void loadDrawings();
    const interval = window.setInterval(() => void loadDrawings(), 5 * 60 * 1000);
    window.addEventListener("focus", handleFocus);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    const syncCompletedMonths = () => {
      setMonths(buildCompletedMonths(new Date()));
    };
    const interval = window.setInterval(syncCompletedMonths, 60 * 60 * 1000);
    window.addEventListener("focus", syncCompletedMonths);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", syncCompletedMonths);
    };
  }, []);

  useEffect(() => {
    if (!activeMonthId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveMonthId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMonthId]);

  const activeMonth = months.find((month) => month.id === activeMonthId);
  const monthRows = Array.from(
    { length: Math.ceil(months.length / 3) },
    (_, rowIndex) => months.slice(rowIndex * 3, rowIndex * 3 + 3),
  );

  const saveDrawing = async (
    monthId: string,
    image: Blob,
    message: string,
    code: string,
  ) => {
    const form = new FormData();
    form.append("image", image, `${monthId}.webp`);
    form.append("message", message);
    form.append("code", code);

    const response = await fetch(`/api/drawings/${monthId}`, {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as {
      drawing?: PublicDrawing;
      error?: string;
    };
    if (!response.ok || !payload.drawing) {
      throw new Error(payload.error ?? "Desenul nu a putut fi publicat.");
    }

    setDrawings((current) => ({
      ...current,
      [monthId]: payload.drawing as PublicDrawing,
    }));
  };

  return (
    <main className="site-shell" id="top">
      <div className="repeating-background">
        <section className="calendar-section" id="calendar" aria-label="Calendarul ușilor">
          <h1 className="sr-only">Calendarul ușilor, din martie 2025 până în prezent</h1>
          <div className="months-grid">
            {monthRows.map((row, rowIndex) => (
              <div
                className={`month-row month-row--${rowIndex === 0 ? "top" : "middle"}`}
                key={row[0].id}
                style={{ "--row-layer": monthRows.length - rowIndex } as CSSProperties}
              >
                <div className="month-row-grid">
                  {row.map((month) => (
                    <MonthCard
                      key={month.id}
                      month={month}
                      drawing={drawings[month.id]?.imageUrl}
                      onOpen={() => setActiveMonthId(month.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {activeMonth ? (
        <FocusModal
          month={activeMonth}
          drawing={drawings[activeMonth.id]}
          publicationCode={publicationCode}
          onPublicationCodeChange={setPublicationCode}
          onSave={(image, message, code) =>
            saveDrawing(activeMonth.id, image, message, code)
          }
          onClose={() => setActiveMonthId(null)}
        />
      ) : null}
    </main>
  );
}
