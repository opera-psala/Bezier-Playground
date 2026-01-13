import { Point, User, BezierCurve } from '../types';

export class PresenceRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;
  }

  render(users: User[], curves: BezierCurve[]): void {
    users.forEach(user => {
      // Highlight active curve
      if (user.activeCurveId) {
        this.highlightActiveCurve(user, curves);
      }

      // Draw cursor
      if (user.cursor) {
        this.drawCursor(user.cursor, user.name, user.color);
      }
    });
  }

  private highlightActiveCurve(user: User, curves: BezierCurve[]): void {
    const curve = curves.find(c => c.id === user.activeCurveId);
    if (!curve || curve.points.length < 2) return;

    // Draw a subtle glow around the curve
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = user.color;
    this.ctx.strokeStyle = user.color;
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.3;

    this.ctx.beginPath();
    this.ctx.moveTo(curve.points[0].x, curve.points[0].y);
    for (let i = 1; i < curve.points.length; i++) {
      this.ctx.lineTo(curve.points[i].x, curve.points[i].y);
    }
    this.ctx.stroke();

    // Reset shadow and alpha
    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;
  }

  private drawCursor(position: Point, userName: string, color: string): void {
    // Draw cursor arrow
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1;

    this.ctx.beginPath();
    this.ctx.moveTo(position.x, position.y);
    this.ctx.lineTo(position.x + 12, position.y + 12);
    this.ctx.lineTo(position.x + 6, position.y + 12);
    this.ctx.lineTo(position.x, position.y + 18);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Draw user name label
    const padding = 4;
    const text = userName;
    const metrics = this.ctx.measureText(text);
    const labelWidth = metrics.width + padding * 2;
    const labelHeight = 16;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(position.x + 14, position.y + 2, labelWidth, labelHeight);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px system-ui';
    this.ctx.fillText(text, position.x + 14 + padding, position.y + 2 + 12);
  }
}
