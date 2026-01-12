import { BezierCurve, Point } from '../types';
import { getBezierPath } from '../bezier';

export class CurveManager {
  private curves: BezierCurve[] = [];
  private activeCurveId: string | null = null;
  private colorPalette = ['#4a9eff', '#ff4a9e', '#4aff9e', '#ff9e4a', '#9e4aff', '#4afff9'];
  private nextColorIndex = 0;

  constructor() {
    this.addCurve();
  }

  addCurve(): string {
    const id = Math.random().toString(36).substr(2, 9);
    const color = this.colorPalette[this.nextColorIndex];
    this.nextColorIndex = (this.nextColorIndex + 1) % this.colorPalette.length;

    this.curves.push({ id, points: [], color });
    this.activeCurveId = id;
    return id;
  }

  removeCurve(id: string) {
    const index = this.curves.findIndex(c => c.id === id);
    if (index === -1) return;

    this.curves.splice(index, 1);

    if (this.activeCurveId === id) {
      this.activeCurveId = this.curves.length > 0 ? this.curves[0].id : null;
    }

    if (this.curves.length === 0) {
      this.addCurve();
    }
  }

  setActiveCurve(id: string) {
    if (this.curves.find(c => c.id === id)) {
      this.activeCurveId = id;
    }
  }

  getActiveCurve(): BezierCurve | null {
    return this.curves.find(c => c.id === this.activeCurveId) || null;
  }

  getAllCurves(): BezierCurve[] {
    return this.curves;
  }

  getActiveCurvePoints(): Point[] {
    return this.getActiveCurve()?.points || [];
  }

  setActiveCurvePoints(points: Point[]) {
    const curve = this.getActiveCurve();
    if (curve) {
      curve.points = points;
    }
  }

  clearAllCurves() {
    this.curves.length = 0;
    this.addCurve();
  }

  findCurveAtPosition(pos: Point, threshold = 15): string | null {
    for (const curve of this.curves) {
      if (curve.points.length < 2) continue;

      const path = getBezierPath(curve.points, 50);
      for (const point of path) {
        const dx = point.x - pos.x;
        const dy = point.y - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          return curve.id;
        }
      }
    }
    return null;
  }

  toJSON() {
    return { curves: this.curves };
  }

  fromJSON(data: { curves: BezierCurve[] }) {
    if (data.curves && Array.isArray(data.curves)) {
      this.curves.length = 0;
      this.curves.push(...data.curves);
      this.activeCurveId = this.curves[0]?.id || null;
    }
  }
}
