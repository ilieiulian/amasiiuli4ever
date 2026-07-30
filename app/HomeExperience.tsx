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
  const [color, setColor] = useState("#8f3d4f");
  const [brushSize, setBrushSize] = useState(12);
  const [isEraser, setIsEraser] = useState(false);
  const [importedFileName, setImportedFileName] = useState("");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");

  const restoreSnapshot = (snapshot?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, canvas.width, canvas.height);
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
    context.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    context.strokeStyle = color;
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

    historyRef.current.push(canvas.toDataURL("image/webp", 0.86));
    if (historyRef.current.length > 24) historyRef.current.shift();

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

          context.globalCompositeOperation = "source-over";
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, x, y, width, height);
          resolve();
        };
        image.onerror = () => reject(new Error("Imaginea nu a putut fi deschisă."));
        image.src = objectUrl;
      });
      setImportedFileName(file.name);
      setIsEraser(false);
      setSaved(false);
      setSaveFeedback("Imaginea a fost adăugată. Poți desena peste ea înainte de publicare.");
    } catch (error) {
      historyRef.current.pop();
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
        <p className="studio-tip">Desenează sau pornește de la o imagine din dispozitiv.</p>
      </div>

      <div className="studio-body">
        <div className="studio-workbench">
          <div className="canvas-meta" aria-hidden="true">
            <span>Foaie de lucru</span>
            <span>600 × 600 px</span>
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
              <span>Instrumente</span>
              <span>deget · mouse · stylus</span>
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
                <output>{brushSize}px</output>
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
                <span aria-hidden="true">↶</span> Înapoi
              </button>
              <button className="tool-button" type="button" onClick={clearCanvas}>
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
