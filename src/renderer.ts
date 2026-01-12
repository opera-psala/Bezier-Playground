import { Point, BezierCurve, VisualizationMode } from './types';
import { getBezierPath, getDeCasteljauLevels } from './bezier';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;
    this.resize();
  }

  resize() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawPoint(point: Point, color = '#4a9eff', radius = 6) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawLine(from: Point, to: Point, color = '#666', width = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
  }

  drawControlPolygon(points: Point[], color = '#666') {
    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      this.drawLine(points[i], points[i + 1], color, 1);
    }
  }

  drawBezierCurve(points: Point[], color = '#4a9eff') {
    if (points.length < 2) return;

    const path = getBezierPath(points);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(path[0].x, path[0].y);

    for (let i = 1; i < path.length; i++) {
      this.ctx.lineTo(path[i].x, path[i].y);
    }

    this.ctx.stroke();
  }

  drawAnimatedPoint(point: Point) {
    this.drawPoint(point, '#ff4a4a', 8);
  }

  render(points: Point[], animatedPoint: Point | null) {
    this.clear();

    if (points.length > 0) {
      if (points.length > 1) {
        this.drawControlPolygon(points);
        this.drawBezierCurve(points);
      }

      points.forEach(point => this.drawPoint(point));
    }

    if (animatedPoint) {
      this.drawAnimatedPoint(animatedPoint);
    }
  }

  renderMultipleCurves(
    curves: BezierCurve[],
    activeCurveId: string | null,
    animatedPoints: Map<string, Point>,
    visualizationMode: VisualizationMode = 'simple',
    animationProgress = 0
  ) {
    this.clear();

    curves.forEach(curve => {
      const isActive = curve.id === activeCurveId;
      const alpha = isActive ? 1 : 0.3;

      if (curve.points.length > 1) {
        const dimmedColor = this.adjustAlpha(curve.color, alpha);
        this.drawBezierCurve(curve.points, dimmedColor);

        if (isActive) {
          this.drawControlPolygon(curve.points, '#666');
        }

        if (
          isActive &&
          (visualizationMode === 'decasteljau' ||
            visualizationMode === 'tslider') &&
          animationProgress > 0
        ) {
          this.drawConstructionLines(
            curve.points,
            animationProgress,
            curve.color
          );
        }
      }

      if (isActive) {
        curve.points.forEach(point => this.drawPoint(point, curve.color));
      }

      const animatedPoint = animatedPoints.get(curve.id);
      if (animatedPoint) {
        this.drawAnimatedPoint(animatedPoint);
      }
    });
  }

  drawConstructionLines(points: Point[], t: number, color: string) {
    const levels = getDeCasteljauLevels(points, t);

    for (let levelIndex = 1; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex];
      const alpha = 0.3 + (0.5 * levelIndex) / levels.length;
      const levelColor = this.adjustAlpha(color, alpha);

      for (let i = 0; i < level.length; i++) {
        this.drawPoint(level[i], levelColor, 3);
      }

      for (let i = 0; i < level.length - 1; i++) {
        this.drawLine(level[i], level[i + 1], levelColor, 1);
      }
    }
  }

  private adjustAlpha(color: string, alpha: number): string {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
