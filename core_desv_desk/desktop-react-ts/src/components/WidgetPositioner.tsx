import { useState, useRef } from "react";

export default function WidgetPositioner() {
  const BOX_SIZE = 300;      // tamaño del cuadro visible
  const DOT_SIZE = 16;       // tamaño del punto
  const widgetSize = 80;     // tamaño real del widget
  const dragging = useRef(false);

  const [dotPos, setDotPos] = useState({
    x: BOX_SIZE / 2 - DOT_SIZE / 2,
    y: BOX_SIZE / 2 - DOT_SIZE / 2,
  });

  const handleMouseDown = () => {
    dragging.current = true;
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let x = e.clientX - rect.left - DOT_SIZE / 2;
    let y = e.clientY - rect.top - DOT_SIZE / 2;

    // Limitar dentro del cuadro
    x = Math.max(0, Math.min(x, BOX_SIZE - DOT_SIZE));
    y = Math.max(0, Math.min(y, BOX_SIZE - DOT_SIZE));

    setDotPos({ x, y });

    // ==== Traducción a coordenadas de pantalla ====

    const screenW = window.screen.width;
    const screenH = window.screen.height;

    const widgetX = (x / (BOX_SIZE - DOT_SIZE)) * (screenW - widgetSize);
    const widgetY = (y / (BOX_SIZE - DOT_SIZE)) * (screenH - widgetSize);

    // Mandar IPC a Electron
    (window as any).electron.ipcRenderer.send("widget:set-position", {
      x: widgetX,
      y: widgetY,
    });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold">Posición del Widget</h2>

      <div
        className="relative border border-gray-400 rounded-md"
        style={{
          width: BOX_SIZE,
          height: BOX_SIZE,
          background: "#f5f5f5",
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            position: "absolute",
            left: dotPos.x,
            top: dotPos.y,
            background: "#3b82f6",
            borderRadius: "50%",
            cursor: "grab",
          }}
        />
      </div>

      <p className="text-gray-600 text-sm">
        Arrastra el punto para mover el widget en la pantalla
      </p>
    </div>
  );
}
