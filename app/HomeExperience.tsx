"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Month = {
  id: string;
  name: string;
  accent: string;
  door: string;
  doorTextureMonthlyPng: string;
  doorTextureJpg: string;
  doorTexturePng: string;
};

const MONTH_NAMES = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
] as const;

const MONTH_TEXTURE_FILES = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
] as const;

const MONTH_PALETTE = [
  ["#cd6a4b", "#efb7a6"], ["#b84c67", "#e6a7b5"], ["#6f8e67", "#b7c8a8"],
  ["#9b7359", "#dcc1a9"], ["#b57a8d", "#e8c1cd"], ["#c28b3e", "#e7c88e"],
  ["#c9643e", "#eda07f"], ["#a75b3c", "#d9906e"], ["#717f5d", "#b8c29e"],
  ["#9d5f3d", "#d99a72"], ["#746175", "#bcaabd"], ["#486e65", "#91b5ab"],
] as const;

function buildCompletedMonths(now: Date): Month[] {
  const result: Month[] = [];
  const cursor = new Date(2025, 2, 1);
  const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  while (cursor <= lastCompletedMonth) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const monthNumber = String(monthIndex + 1).padStart(2, "0");
    const [accent, door] = MONTH_PALETTE[monthIndex];
    result.push({
      id: `${year}-${monthNumber}`,
      name: `${MONTH_NAMES[monthIndex]} ${year}`,
      accent,
      door,
      doorTextureMonthlyPng: `/texturi/usi/${MONTH_TEXTURE_FILES[monthIndex]}.png`,
      doorTextureJpg: `/texturi/usi/${year}-${monthNumber}.jpg`,
      doorTexturePng: `/texturi/usi/${year}-${monthNumber}.png`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

const STORAGE_KEY = "amasiiuli4ever-drawings";
const CANVAS_BACKGROUND = "#fffaf3";

function PlaceholderArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`art-placeholder${compact ? " art-placeholder--compact" : ""}`}>
      <span className="placeholder-corners" aria-hidden="true" />
      <span className="placeholder-mark" aria-hidden="true">+</span>
      <span className="placeholder-title">Desenul vostru</span>
      <span className="placeholder-note">placeholder</span>
    </div>
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
    "--door-color": month.door,
    "--door-texture-monthly-png": `url("${month.doorTextureMonthlyPng}")`,
    "--door-texture-png": `url("${month.doorTexturePng}")`,
    "--door-texture-jpg": `url("${month.doorTextureJpg}")`,
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
        {drawing ? (
          <span
            className="saved-art"
            style={{ backgroundImage: `url(${drawing})` }}
            role="img"
            aria-label={`Desen salvat pentru ${month.name}`}
          />
        ) : (
          <PlaceholderArtwork compact />
        )}
        <DoorPanels />
      </span>
      <span className="month-meta">
        <span className="month-name">{month.name}</span>
        <span className="month-state">{drawing ? "desen salvat" : "de desenat"}</span>
      </span>
    </button>
  );
}

function DrawingStudio({
  month,
  initialDrawing,
  onSave,
}: {
  month: Month;
  initialDrawing?: string;
  onSave: (data: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const [color, setColor] = useState("#8f3d4f");
  const [brushSize, setBrushSize] = useState(12);
  const [isEraser, setIsEraser] = useState(false);
  const [saved, setSaved] = useState(false);

  const paintCanvasBackground = (context: CanvasRenderingContext2D) => {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = CANVAS_BACKGROUND;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.restore();
  };

  const restoreSnapshot = (snapshot?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    paintCanvasBackground(context);
    if (!snapshot) return;

    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = snapshot;
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

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, scale: 1 };
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
      scale: canvas.width / bounds.width,
    };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    historyRef.current.push(canvas.toDataURL("image/webp", 0.86));
    if (historyRef.current.length > 24) historyRef.current.shift();

    const point = getCanvasPoint(event);
    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = isEraser ? CANVAS_BACKGROUND : color;
    context.lineWidth = brushSize * point.scale;
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !isDrawingRef.current) return;
    context.closePath();
    isDrawingRef.current = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    setSaved(false);
  };

  const undo = () => {
    const snapshot = historyRef.current.pop();
    if (snapshot) restoreSnapshot(snapshot);
    setSaved(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    historyRef.current.push(canvas.toDataURL("image/webp", 0.86));
    context.clearRect(0, 0, canvas.width, canvas.height);
    paintCanvasBackground(context);
    setSaved(false);
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/webp", 0.9));
    setSaved(true);
  };

  return (
    <section className="studio" aria-label={`Atelier de desen pentru ${month.name}`}>
      <div className="studio-heading">
        <div>
          <p className="studio-kicker">Atelierul vostru</p>
          <h2>Desenează luna {month.name}</h2>
        </div>
        <p className="studio-tip">Folosește degetul, mouse-ul sau stylus-ul.</p>
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

      <div className="studio-controls">
        <label className="control control--color">
          <span>Culoare</span>
          <input
            type="color"
            value={color}
            onChange={(event) => {
              setColor(event.target.value);
              setIsEraser(false);
            }}
            aria-label="Alege culoarea pensulei"
          />
        </label>

        <label className="control control--range">
          <span>Grosime</span>
          <input
            type="range"
            min="3"
            max="36"
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            aria-label="Grosimea pensulei"
          />
        </label>

        <button
          className={`tool-button${isEraser ? " is-active" : ""}`}
          type="button"
          onClick={() => setIsEraser((value) => !value)}
          aria-pressed={isEraser}
        >
          <span aria-hidden="true">◇</span> Gumă
        </button>
        <button className="tool-button" type="button" onClick={undo}>
          <span aria-hidden="true">↶</span> Undo
        </button>
        <button className="tool-button" type="button" onClick={clearCanvas}>
          <span aria-hidden="true">×</span> Șterge
        </button>
      </div>

      <button className="save-button" type="button" onClick={saveCanvas}>
        <span>{saved ? "Salvat în calendar" : `Salvează în ${month.name}`}</span>
        <span aria-hidden="true">{saved ? "✓" : "→"}</span>
      </button>
      <p className="save-note" aria-live="polite">
        {saved
          ? "Desenul apare acum în pătratul lunii."
          : "Desenul se păstrează pe acest dispozitiv."}
      </p>
    </section>
  );
}

function FocusModal({
  month,
  drawing,
  onSave,
  onClose,
}: {
  month: Month;
  drawing?: string;
  onSave: (data: string) => void;
  onClose: () => void;
}) {
  const modalStyle = {
    "--month-accent": month.accent,
    "--door-color": month.door,
    "--door-texture-monthly-png": `url("${month.doorTextureMonthlyPng}")`,
    "--door-texture-png": `url("${month.doorTexturePng}")`,
    "--door-texture-jpg": `url("${month.doorTextureJpg}")`,
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
            {drawing ? (
              <span className="saved-art" style={{ backgroundImage: `url(${drawing})` }} />
            ) : (
              <PlaceholderArtwork />
            )}
            <DoorPanels />
          </div>

          <p className="focus-caption">
            Ușile s-au deschis. Lasă înăuntru desenul care păstrează luna aceasta.
          </p>
        </div>

        <DrawingStudio
          key={month.id}
          month={month}
          initialDrawing={drawing}
          onSave={onSave}
        />
      </div>
    </div>
  );
}

export default function HomeExperience() {
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const [activeMonthId, setActiveMonthId] = useState<string | null>(null);
  const [months, setMonths] = useState<Month[]>(() => buildCompletedMonths(new Date()));

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setDrawings(JSON.parse(saved) as Record<string, string>);
    } catch {
      // A private browser session can block local storage; drawing still works in-session.
    }
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

  const saveDrawing = (monthId: string, data: string) => {
    setDrawings((current) => {
      const next = { ...current, [monthId]: data };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Keep the current session usable even if the device storage is full.
      }
      return next;
    });
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
              >
                <div className="month-row-grid">
                  {row.map((month) => (
                    <MonthCard
                      key={month.id}
                      month={month}
                      drawing={drawings[month.id]}
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
          onSave={(data) => saveDrawing(activeMonth.id, data)}
          onClose={() => setActiveMonthId(null)}
        />
      ) : null}
    </main>
  );
}
