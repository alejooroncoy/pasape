"use client";

import { useEffect, useRef } from "react";

const drawSquare = (canvas: HTMLCanvasElement, code: string) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#050507";
  const grid = 21;
  const cell = size / grid;
  let hash = 0;
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const bit = ((hash ^ (x * 73856093) ^ (y * 19349663)) >>> 0) & 1;
      const corner =
        (x < 7 && y < 7) ||
        (x >= grid - 7 && y < 7) ||
        (x < 7 && y >= grid - 7);
      if (corner) {
        const inEye =
          (x < 7 && y < 7 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))) ||
          (x >= grid - 7 && y < 7 && (x === grid - 7 || x === grid - 1 || y === 0 || y === 6 || (x >= grid - 5 && x <= grid - 3 && y >= 2 && y <= 4))) ||
          (x < 7 && y >= grid - 7 && (x === 0 || x === 6 || y === grid - 7 || y === grid - 1 || (x >= 2 && x <= 4 && y >= grid - 5 && y <= grid - 3)));
        if (inEye) ctx.fillRect(x * cell, y * cell, cell, cell);
        continue;
      }
      if (bit) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
};

export const QrCanvas = ({ code, size = 280 }: { code: string; size?: number }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) drawSquare(ref.current, code);
  }, [code]);
  return <canvas ref={ref} width={size} height={size} className="rounded-2xl" />;
};
