import { CurveManager } from './CurveManager';
import { InteractionManager } from '../interaction';
import { exportToSVG } from '../bezier';
import { validatePointsArray, validateCurvesData } from '../fileUtils';

export interface FileManagerCallbacks {
  onCurvesLoaded: () => void;
  onRender: () => void;
  onUpdateCurveSelector: () => void;
}

export class FileManager {
  constructor(
    private curveManager: CurveManager,
    private interaction: InteractionManager,
    private canvas: HTMLCanvasElement,
    private callbacks: FileManagerCallbacks
  ) {
    this.setupDragAndDrop();
  }

  exportToSVG(): void {
    const points = this.curveManager.getActiveCurvePoints();
    const svgContent = exportToSVG(points, this.canvas.width, this.canvas.height);
    this.downloadSVG(svgContent);
  }

  saveToJSON(): void {
    const data = this.curveManager.toJSON();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bezier-curves.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  loadFromJSON(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.loadJSONFromFile(file);
    };
    input.click();
  }

  private setupDragAndDrop(): void {
    const dropOverlay = document.getElementById('drop-overlay');
    const appContainer = document.getElementById('app');

    if (!dropOverlay || !appContainer) return;

    let dragCounter = 0;

    appContainer.addEventListener('dragenter', e => {
      e.preventDefault();
      dragCounter++;
      dropOverlay.classList.add('active');
    });

    appContainer.addEventListener('dragleave', () => {
      dragCounter--;
      if (dragCounter === 0) {
        dropOverlay.classList.remove('active');
      }
    });

    appContainer.addEventListener('dragover', e => {
      e.preventDefault();
    });

    appContainer.addEventListener('drop', e => {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.remove('active');

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.name.endsWith('.json')) {
        alert('Please drop a JSON file');
        return;
      }

      this.loadJSONFromFile(file);
    });
  }

  private loadJSONFromFile(file: File): void {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);

        if (data.curves) {
          if (!validateCurvesData(data.curves)) {
            alert('Improperly structured JSON file: Invalid curves data');
            return;
          }
          this.curveManager.fromJSON(data);
        } else if (data.points) {
          if (!validatePointsArray(data.points)) {
            alert('Improperly structured JSON file: Invalid points data');
            return;
          }
          this.curveManager.clearAllCurves();
          this.curveManager.setActiveCurvePoints(data.points);
        } else {
          alert('Improperly structured JSON file: Missing curves or points');
          return;
        }

        this.callbacks.onCurvesLoaded();
        this.interaction.setPoints(this.curveManager.getActiveCurvePoints());
        this.callbacks.onUpdateCurveSelector();
        this.callbacks.onRender();
      } catch (error) {
        if (error instanceof SyntaxError) {
          alert('Invalid JSON file: Syntax error');
        } else {
          alert('Error loading file: ' + (error as Error).message);
        }
      }
    };
    reader.readAsText(file);
  }

  private downloadSVG(svgContent: string): void {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bezier-curve.svg';
    link.click();
    URL.revokeObjectURL(url);
  }
}
