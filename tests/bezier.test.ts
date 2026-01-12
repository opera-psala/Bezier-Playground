import { describe, it, expect } from 'vitest';
import { evaluateBezier, getBezierPath, getDeCasteljauLevels, exportToSVG } from '../src/bezier';
import { Point } from '../src/types';

describe('bezier', () => {
  describe('evaluateBezier', () => {
    it('should return origin for empty points array', () => {
      const result = evaluateBezier([], 0.5);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should return the point itself for single point', () => {
      const points: Point[] = [{ x: 100, y: 200 }];
      const result = evaluateBezier(points, 0.5);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should interpolate between two points (linear)', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const result = evaluateBezier(points, 0.5);
      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should return start point at t=0', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const result = evaluateBezier(points, 0);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('should return end point at t=1', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const result = evaluateBezier(points, 1);
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(0);
    });

    it('should evaluate quadratic Bezier curve at t=0.5', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const result = evaluateBezier(points, 0.5);
      expect(result.x).toBeCloseTo(50);
      expect(result.y).toBeCloseTo(50);
    });

    it('should evaluate cubic Bezier curve', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 33, y: 100 },
        { x: 66, y: 100 },
        { x: 100, y: 0 },
      ];

      const result = evaluateBezier(points, 0.5);
      // For cubic bezier with these control points, at t=0.5:
      // x = 0.125*0 + 0.375*33 + 0.375*66 + 0.125*100 = 49.625
      // y = 0.125*0 + 0.375*100 + 0.375*100 + 0.125*0 = 75
      expect(result.x).toBeCloseTo(49.625);
      expect(result.y).toBeCloseTo(75);
    });

    it('should handle high-order Bezier curves', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 20, y: 80 },
        { x: 40, y: 80 },
        { x: 60, y: 80 },
        { x: 80, y: 80 },
        { x: 100, y: 0 },
      ];

      const result = evaluateBezier(points, 0.5);
      expect(result.x).toBeCloseTo(50);
      expect(result.y).toBeGreaterThan(0);
    });
  });

  describe('getBezierPath', () => {
    it('should generate path with correct number of points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const path = getBezierPath(points, 10);
      expect(path).toHaveLength(11); // 0 to 10 inclusive
    });

    it('should generate default 100 segments', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const path = getBezierPath(points);
      expect(path).toHaveLength(101);
    });

    it('should start at first control point', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 50, y: 100 },
        { x: 90, y: 20 },
      ];

      const path = getBezierPath(points, 10);
      expect(path[0]).toEqual({ x: 10, y: 20 });
    });

    it('should end at last control point', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 50, y: 100 },
        { x: 90, y: 20 },
      ];

      const path = getBezierPath(points, 10);
      const lastPoint = path[path.length - 1];
      expect(lastPoint.x).toBeCloseTo(90);
      expect(lastPoint.y).toBeCloseTo(20);
    });

    it('should generate smooth curve for quadratic bezier', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const path = getBezierPath(points, 4);
      expect(path).toHaveLength(5);

      // Check that middle point is at peak
      const middlePoint = path[2];
      expect(middlePoint.x).toBeCloseTo(50);
      expect(middlePoint.y).toBeCloseTo(50);
    });
  });

  describe('getDeCasteljauLevels', () => {
    it('should return all levels for linear curve', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const levels = getDeCasteljauLevels(points, 0.5);
      expect(levels).toHaveLength(2);
      expect(levels[0]).toEqual(points);
      expect(levels[1]).toHaveLength(1);
      expect(levels[1][0]).toEqual({ x: 50, y: 50 });
    });

    it('should return all levels for quadratic curve', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const levels = getDeCasteljauLevels(points, 0.5);
      expect(levels).toHaveLength(3);
      expect(levels[0]).toHaveLength(3); // Original control points
      expect(levels[1]).toHaveLength(2); // First intermediate level
      expect(levels[2]).toHaveLength(1); // Final point
    });

    it('should return all levels for cubic curve', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 33, y: 100 },
        { x: 66, y: 100 },
        { x: 100, y: 0 },
      ];

      const levels = getDeCasteljauLevels(points, 0.5);
      expect(levels).toHaveLength(4);
      expect(levels[0]).toHaveLength(4);
      expect(levels[1]).toHaveLength(3);
      expect(levels[2]).toHaveLength(2);
      expect(levels[3]).toHaveLength(1);
    });

    it('should preserve original points in first level', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ];

      const levels = getDeCasteljauLevels(points, 0.7);
      expect(levels[0]).toEqual(points);
    });

    it('should match evaluateBezier result in final level', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const t = 0.3;
      const levels = getDeCasteljauLevels(points, t);
      const finalPoint = levels[levels.length - 1][0];
      const directEval = evaluateBezier(points, t);

      expect(finalPoint.x).toBeCloseTo(directEval.x);
      expect(finalPoint.y).toBeCloseTo(directEval.y);
    });

    it('should handle t=0', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const levels = getDeCasteljauLevels(points, 0);
      const finalPoint = levels[levels.length - 1][0];
      expect(finalPoint).toEqual(points[0]);
    });

    it('should handle t=1', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const levels = getDeCasteljauLevels(points, 1);
      const finalPoint = levels[levels.length - 1][0];
      expect(finalPoint).toEqual(points[points.length - 1]);
    });
  });

  describe('exportToSVG', () => {
    it('should return empty string for curves with less than 2 points', () => {
      expect(exportToSVG([], 800, 600)).toBe('');
      expect(exportToSVG([{ x: 10, y: 20 }], 800, 600)).toBe('');
    });

    it('should generate linear path for 2 points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const svg = exportToSVG(points, 800, 600);
      expect(svg).toContain('M 0 0');
      expect(svg).toContain('L 100 100');
      expect(svg).toContain('width="800"');
      expect(svg).toContain('height="600"');
    });

    it('should generate quadratic path for 3 points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      const svg = exportToSVG(points, 800, 600);
      expect(svg).toContain('M 0 0');
      expect(svg).toContain('Q 50 100 100 0');
    });

    it('should generate cubic path for 4 points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 33, y: 100 },
        { x: 66, y: 100 },
        { x: 100, y: 0 },
      ];

      const svg = exportToSVG(points, 800, 600);
      expect(svg).toContain('M 0 0');
      expect(svg).toContain('C 33 100 66 100 100 0');
    });

    it('should generate polyline for more than 4 points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 20, y: 50 },
        { x: 40, y: 50 },
        { x: 60, y: 50 },
        { x: 80, y: 50 },
        { x: 100, y: 0 },
      ];

      const svg = exportToSVG(points, 800, 600);
      expect(svg).toContain('M 0 0');
      expect(svg).toContain('L '); // Should contain line segments
    });

    it('should have proper SVG structure', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const svg = exportToSVG(points, 800, 600);
      expect(svg).toContain('<svg');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('<path');
      expect(svg).toContain('fill="none"');
      expect(svg).toContain('stroke="#4a9eff"');
      expect(svg).toContain('stroke-width="2"');
      expect(svg).toContain('</svg>');
    });

    it('should use provided dimensions', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const svg = exportToSVG(points, 1920, 1080);
      expect(svg).toContain('width="1920"');
      expect(svg).toContain('height="1080"');
    });
  });
});
