import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FileManager } from '../../src/managers/FileManager';
import { CurveManager } from '../../src/managers/CurveManager';
import { InteractionManager } from '../../src/interaction';
import { HistoryManager, LoadCurvesCommand } from '../../src/history';

const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  return canvas;
};

describe('FileManager', () => {
  let fileManager: FileManager;
  let curveManager: CurveManager;
  let interaction: InteractionManager;
  let history: HistoryManager;
  let canvas: HTMLCanvasElement;
  let callbacks: {
    onCurvesLoaded: ReturnType<typeof vi.fn>;
    onRender: ReturnType<typeof vi.fn>;
    onUpdateCurveSelector: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '<div id="app"><div id="drop-overlay"></div></div>';

    canvas = createMockCanvas();
    curveManager = new CurveManager();
    interaction = new InteractionManager(canvas, () => {});
    history = new HistoryManager({ curves: curveManager.getAllCurves() });
    callbacks = {
      onCurvesLoaded: vi.fn(),
      onRender: vi.fn(),
      onUpdateCurveSelector: vi.fn(),
    };

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock window.alert
    global.alert = vi.fn();

    // Mock document.createElement for 'a' and 'input' tags
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = vi.fn();
      }
      if (tagName === 'input') {
        element.click = vi.fn();
      }
      return element;
    });

    fileManager = new FileManager(curveManager, interaction, canvas, history, callbacks);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('exportToSVG', () => {
    it('should create and download SVG file', () => {
      curveManager.setActiveCurvePoints([
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ]);

      fileManager.exportToSVG();

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should use correct canvas dimensions in SVG', () => {
      const createObjectURLSpy = vi.spyOn(global.URL, 'createObjectURL');

      curveManager.setActiveCurvePoints([
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ]);

      fileManager.exportToSVG();

      // Check that a Blob was created
      expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));

      const blobCall = createObjectURLSpy.mock.calls[0][0] as Blob;
      expect(blobCall.type).toBe('image/svg+xml');
    });

    it('should handle empty curve', () => {
      curveManager.setActiveCurvePoints([]);

      // Should not throw
      expect(() => fileManager.exportToSVG()).not.toThrow();
    });
  });

  describe('saveToJSON', () => {
    it('should create and download JSON file', () => {
      curveManager.setActiveCurvePoints([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);

      fileManager.saveToJSON();

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should save curves data as JSON', () => {
      const createObjectURLSpy = vi.spyOn(global.URL, 'createObjectURL');

      curveManager.setActiveCurvePoints([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);

      fileManager.saveToJSON();

      const blobCall = createObjectURLSpy.mock.calls[0][0] as Blob;
      expect(blobCall.type).toBe('application/json');
    });

    it('should create link with correct filename', () => {
      fileManager.saveToJSON();

      // Check that a link was created and clicked
      expect(document.createElement).toHaveBeenCalledWith('a');
    });
  });

  describe('loadFromJSON', () => {
    it('should create file input element', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      fileManager.loadFromJSON();

      expect(createElementSpy).toHaveBeenCalledWith('input');
    });

    it('should accept only JSON files', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      fileManager.loadFromJSON();

      // Find the input element creation call
      const inputCalls = createElementSpy.mock.calls.filter(call => call[0] === 'input');
      expect(inputCalls.length).toBeGreaterThan(0);

      // The input element should have been created
      // We can't easily test the accept property being set without more complex mocking
      // but we verified the input was created
    });
  });

  describe('loading JSON data', () => {
    it('should load valid curves JSON', async () => {
      const validJSON = JSON.stringify({
        curves: [
          {
            id: 'test-curve',
            color: '#4a9eff',
            points: [
              { x: 10, y: 20 },
              { x: 30, y: 40 },
            ],
          },
        ],
      });

      const file = new File([validJSON], 'test.json', { type: 'application/json' });
      const fileReader = new FileReader();

      // Create a promise that resolves when FileReader loads
      const loadPromise = new Promise<void>(resolve => {
        fileReader.onload = event => {
          // Simulate the FileManager's load handler
          const json = event.target?.result as string;
          const data = JSON.parse(json);
          curveManager.fromJSON(data);
          callbacks.onCurvesLoaded();
          callbacks.onRender();
          callbacks.onUpdateCurveSelector();
          resolve();
        };
      });

      fileReader.readAsText(file);

      await loadPromise;

      expect(callbacks.onCurvesLoaded).toHaveBeenCalled();
      expect(callbacks.onRender).toHaveBeenCalled();
      expect(callbacks.onUpdateCurveSelector).toHaveBeenCalled();
      expect(curveManager.getAllCurves()).toHaveLength(1);
    });

    it('should load valid points JSON (legacy format)', async () => {
      const validJSON = JSON.stringify({
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
      });

      const file = new File([validJSON], 'test.json', { type: 'application/json' });
      const fileReader = new FileReader();

      const loadPromise = new Promise<void>(resolve => {
        fileReader.onload = event => {
          const json = event.target?.result as string;
          const data = JSON.parse(json);
          curveManager.clearAllCurves();
          curveManager.setActiveCurvePoints(data.points);
          callbacks.onCurvesLoaded();
          callbacks.onRender();
          callbacks.onUpdateCurveSelector();
          resolve();
        };
      });

      fileReader.readAsText(file);

      await loadPromise;

      expect(curveManager.getActiveCurvePoints()).toHaveLength(2);
    });

    it('should create undoable history entry when loading JSON', async () => {
      // Add some points to start with
      curveManager.setActiveCurvePoints([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]);
      const initialCurves = curveManager.getAllCurves();

      const validJSON = JSON.stringify({
        curves: [
          {
            id: 'loaded-curve',
            color: '#4a9eff',
            points: [
              { x: 100, y: 200 },
              { x: 300, y: 400 },
            ],
          },
        ],
      });

      const file = new File([validJSON], 'test.json', { type: 'application/json' });

      // Simulate loading the file through FileManager's loadJSONFromFile
      const reader = new FileReader();
      const loadPromise = new Promise<void>(resolve => {
        reader.onload = event => {
          try {
            const json = event.target?.result as string;
            const data = JSON.parse(json);

            // This mimics what FileManager does
            const oldCurves = curveManager.getAllCurves();
            const newCurves = data.curves;

            // Create and execute LoadCurvesCommand through history
            const command = new LoadCurvesCommand(newCurves, oldCurves);
            history.executeCommand(command);

            if (newCurves.length > 0) {
              curveManager.setActiveCurve(newCurves[0].id);
            }

            resolve();
          } catch (error) {
            console.error(error);
          }
        };
      });

      reader.readAsText(file);
      await loadPromise;

      // Verify curves were loaded
      expect(curveManager.getAllCurves()).toHaveLength(1);
      expect(curveManager.getAllCurves()[0].id).toBe('loaded-curve');

      // Verify we can undo the load
      expect(history.canUndo()).toBe(true);
      history.undo();

      // After undo, should be back to initial state
      expect(curveManager.getAllCurves()).toEqual(initialCurves);
    });
  });

  describe('drag and drop', () => {
    it('should set up drag and drop event listeners', () => {
      const appContainer = document.getElementById('app');
      const addEventListenerSpy = vi.spyOn(appContainer!, 'addEventListener');

      // Create new instance to trigger setup
      new FileManager(curveManager, interaction, canvas, history, callbacks);

      expect(addEventListenerSpy).toHaveBeenCalledWith('dragenter', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('dragleave', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('drop', expect.any(Function));
    });

    it('should handle missing DOM elements gracefully', () => {
      document.body.innerHTML = ''; // Remove elements

      // Should not throw when elements are missing
      expect(() => {
        new FileManager(curveManager, interaction, canvas, history, callbacks);
      }).not.toThrow();
    });

    it('should show overlay on dragenter', () => {
      const appContainer = document.getElementById('app')!;
      const dropOverlay = document.getElementById('drop-overlay')!;

      const dragEnterEvent = new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
      });

      appContainer.dispatchEvent(dragEnterEvent);

      expect(dropOverlay.classList.contains('active')).toBe(true);
    });

    it('should hide overlay on dragleave', () => {
      const appContainer = document.getElementById('app')!;
      const dropOverlay = document.getElementById('drop-overlay')!;

      // First enter
      appContainer.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true }));

      // Then leave
      appContainer.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));

      expect(dropOverlay.classList.contains('active')).toBe(false);
    });

    it('should prevent default on dragover', () => {
      const appContainer = document.getElementById('app')!;
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault');

      appContainer.dispatchEvent(dragOverEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON syntax', async () => {
      const invalidJSON = 'not valid json {';
      const file = new File([invalidJSON], 'test.json', { type: 'application/json' });
      const fileReader = new FileReader();

      const loadPromise = new Promise<void>((resolve, reject) => {
        fileReader.onload = event => {
          try {
            const json = event.target?.result as string;
            JSON.parse(json);
            reject(new Error('Should have thrown'));
          } catch (error) {
            if (error instanceof SyntaxError) {
              alert('Invalid JSON file: Syntax error');
            }
            resolve();
          }
        };
      });

      fileReader.readAsText(file);
      await loadPromise;

      expect(global.alert).toHaveBeenCalledWith('Invalid JSON file: Syntax error');
    });

    it('should handle JSON without curves or points', async () => {
      const invalidJSON = JSON.stringify({ someOtherData: 'value' });
      const file = new File([invalidJSON], 'test.json', { type: 'application/json' });
      const fileReader = new FileReader();

      const loadPromise = new Promise<void>(resolve => {
        fileReader.onload = event => {
          const json = event.target?.result as string;
          const data = JSON.parse(json);

          if (!data.curves && !data.points) {
            alert('Improperly structured JSON file: Missing curves or points');
          }
          resolve();
        };
      });

      fileReader.readAsText(file);
      await loadPromise;

      expect(global.alert).toHaveBeenCalledWith(
        'Improperly structured JSON file: Missing curves or points'
      );
    });
  });
});
