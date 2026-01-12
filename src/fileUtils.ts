import { Point } from './types';

export function validatePointsArray(points: unknown): points is Point[] {
  if (!Array.isArray(points)) return false;

  return points.every(
    p =>
      p &&
      typeof p === 'object' &&
      'x' in p &&
      'y' in p &&
      typeof p.x === 'number' &&
      typeof p.y === 'number' &&
      !isNaN(p.x) &&
      !isNaN(p.y)
  );
}

export function validateCurvesData(curves: unknown): boolean {
  if (!Array.isArray(curves)) return false;

  return curves.every(
    curve =>
      curve &&
      typeof curve === 'object' &&
      'id' in curve &&
      'points' in curve &&
      'color' in curve &&
      typeof curve.id === 'string' &&
      typeof curve.color === 'string' &&
      validatePointsArray(curve.points)
  );
}
