import { Point, AnimationState, BezierCurve } from './types';
import { evaluateBezier } from './bezier';

export class AnimationManager {
  private state: AnimationState = {
    isAnimating: false,
    progress: 0,
    speed: 0.005,
  };
  private onUpdate: () => void;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  start() {
    this.state.isAnimating = true;
    this.state.progress = 0;
    this.animate();
  }

  stop() {
    this.state.isAnimating = false;
  }

  toggle() {
    if (this.state.isAnimating) {
      this.stop();
    } else {
      this.start();
    }
  }

  private animate = () => {
    if (!this.state.isAnimating) return;

    this.state.progress += this.state.speed;
    if (this.state.progress > 1) {
      this.state.progress = 0;
    }

    this.onUpdate();
    requestAnimationFrame(this.animate);
  };

  getAnimatedPoint(points: Point[], t?: number): Point | null {
    const useT = t !== undefined ? t : this.state.progress;
    if (t === undefined && !this.state.isAnimating) return null;
    if (points.length < 2) return null;
    return evaluateBezier(points, useT);
  }

  getAnimatedPoints(curves: BezierCurve[]): Map<string, Point> {
    const animatedPoints = new Map<string, Point>();

    if (!this.state.isAnimating) return animatedPoints;

    for (const curve of curves) {
      if (curve.points.length >= 2) {
        const point = evaluateBezier(curve.points, this.state.progress);
        animatedPoints.set(curve.id, point);
      }
    }

    return animatedPoints;
  }

  isAnimating(): boolean {
    return this.state.isAnimating;
  }

  setSpeed(speed: number) {
    this.state.speed = speed;
  }

  getSpeed(): number {
    return this.state.speed;
  }

  getProgress(): number {
    return this.state.progress;
  }

  resetProgress() {
    this.state.progress = 0;
  }
}
