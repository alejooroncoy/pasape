type Props = { seedOffset?: number };

export function QrSquare({ seedOffset = 0 }: Props) {
  const size = 21;
  const cells: { x: number; y: number; on: boolean }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const seed = (x * 928371 + y * 1283 + 17 + seedOffset * 7919) % 100;
      cells.push({ x, y, on: seed < 46 });
    }
  }
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
  const finder = (cx: number, cy: number) => (
    <g key={`f${cx}-${cy}`}>
      <rect x={cx} y={cy} width="7" height="7" fill="#0a0a0a" />
      <rect x={cx + 1} y={cy + 1} width="5" height="5" fill="#fff" />
      <rect x={cx + 2} y={cy + 2} width="3" height="3" fill="#0a0a0a" />
    </g>
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {cells.map((c, i) =>
        !inFinder(c.x, c.y) && c.on ? (
          <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="#0a0a0a" />
        ) : null,
      )}
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
    </svg>
  );
}
