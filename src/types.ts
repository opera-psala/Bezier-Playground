export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  id: string;
  points: Point[];
  color: string;
}

export interface AnimationState {
  isAnimating: boolean;
  progress: number;
  speed: number;
}

export type VisualizationMode = 'default' | 'decasteljau' | 'tslider';
