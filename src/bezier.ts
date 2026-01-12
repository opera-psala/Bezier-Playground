import { Point } from './types';

export function evaluateBezier(points: Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const newPoints: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    newPoints.push({
      x: (1 - t) * points[i].x + t * points[i + 1].x,
      y: (1 - t) * points[i].y + t * points[i + 1].y,
    });
  }

  return evaluateBezier(newPoints, t);
}

export function getBezierPath(points: Point[], segments = 100): Point[] {
  const path: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    path.push(evaluateBezier(points, t));
  }
  return path;
}

export function getDeCasteljauLevels(points: Point[], t: number): Point[][] {
  const levels: Point[][] = [];
  let currentLevel = points;
  levels.push([...currentLevel]);

  while (currentLevel.length > 1) {
    const nextLevel: Point[] = [];
    for (let i = 0; i < currentLevel.length - 1; i++) {
      nextLevel.push({
        x: (1 - t) * currentLevel[i].x + t * currentLevel[i + 1].x,
        y: (1 - t) * currentLevel[i].y + t * currentLevel[i + 1].y,
      });
    }
    levels.push([...nextLevel]);
    currentLevel = nextLevel;
  }

  return levels;
}

export function exportToSVG(points: Point[], width: number, height: number) {
  if (points.length < 2) return '';

  let pathData = `M ${points[0].x} ${points[0].y}`;

  if (points.length === 2) {
    pathData += ` L ${points[1].x} ${points[1].y}`;
  } else if (points.length === 3) {
    pathData += ` Q ${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y}`;
  } else if (points.length === 4) {
    pathData += ` C ${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y} ${points[3].x} ${points[3].y}`;
  } else {
    const curvePath = getBezierPath(points);
    curvePath.slice(1).forEach(p => {
      pathData += ` L ${p.x} ${p.y}`;
    });
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <path d="${pathData}" fill="none" stroke="#4a9eff" stroke-width="2"/>
</svg>`;
}
