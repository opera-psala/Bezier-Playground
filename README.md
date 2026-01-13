# Bezier Curve Playground

An interactive web application for creating, editing, and visualizing Bezier curves with multiple visualization modes and animation capabilities.

## Live Demo

🚀 [View on Vercel](https://bezier-playground-65wdoncrq-philip-salas-projects.vercel.app)

## Features

- **Interactive Control Points**: Click to add, drag to move, right-click to delete control points
- **Multiple Curves**: Create and manage multiple Bezier curves with different colors
- **Undo/Redo**: Full tree-history support with keyboard shortcuts 
- **Visualization Modes**:
  - **Default**: Standard Bezier curve rendering
  - **De Casteljau**: Visualize the recursive construction algorithm
  - **t-Slider**: Manually control the curve parameter (t) with a slider
- **Animation**: Animate a point traveling along the curve(s) with adjustable speed
- **File Operations**:
  - Save curves to JSON
  - Load curves from JSON (via file picker or drag-and-drop)
  - Export active curve as SVG
- **Responsive Canvas**: Automatically resizes to fit the viewport

## Tech Stack

- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Canvas API**: High-performance 2D rendering
- **ESLint + Prettier**: Code quality and formatting
- **Vercel**: Deployment platform

## Usage

### Basic Controls

- **Add Point**: Click anywhere on the canvas
- **Move Point**: Click and drag a control point
- **Delete Point**: Right-click on a control point
- **Undo/Redo**: Use buttons or keyboard shortcuts

### Keyboard Shortcuts

- `Ctrl+Z` (or `Cmd+Z` on Mac): Undo
- `Ctrl+Shift+Z` (or `Cmd+Shift+Z` on Mac): Redo
- `Ctrl+Shift+→` (or `Cmd+Shift+→` on Mac): Redo until the next intersection or end of branch
- `Ctrl+Shift+←` (or `Cmd+Shift+←` on Mac): Undo until the next intersection or end of branch
- `Ctrl+Shift+↑/↓` (or `Cmd+Shift+↑/↓` on Mac): Switch history branch at an intersection
- `Escape`: Clear animation artifacts and reset progress

### Multiple Curves

1. Click "New Curve" to create a new curve
2. Use the curve dropdown to switch between curves
3. Each curve has a unique color and can be independently edited
4. Click "Delete Curve" to remove the active curve
5. Click "Clear All" to remove all curves

### Visualization Modes

- **Default**: Shows curves, control points, and control polygon
- **De Casteljau**: Displays the recursive linear interpolation construction
- **t-Slider**: Manual control of the curve parameter (0.00 to 1.00)

### File Operations

- **Save JSON**: Download all curves as a JSON file
- **Load JSON**: Import curves from a JSON file
- **Export SVG**: Export the active curve as an SVG file
- **Drag & Drop**: Drag a JSON file onto the canvas to load it

### JSON Format

```json
{
  "curves": [
    {
      "id": "unique-id",
      "color": "#4a9eff",
      "points": [
        { "x": 100, "y": 200 },
        { "x": 300, "y": 100 }
      ]
    }
  ],
  "activeCurveId": "unique-id"
}
```

## How I used Claude Code

- **Plan before executing**: Asked Claude to analyze the codebase and create a refactoring plan before making changes, avoiding costly rewrites
  - *"main.ts is too large, help me break it down" → received detailed dependency analysis and step-by-step plan*

- **Be explicit about constraints**: Mentioned file size limits, deployment concerns, and preferences upfront to get tailored solutions
  - *"Chromium is too big" → pivoted from Playwright to lightweight Vitest + happy-dom*

- **Iterate on solutions**: When tests failed, shared error messages and let Claude fix incrementally rather than rewriting from scratch
  - Fixed animation timing issues, mathematical precision errors, and import paths through quick iterations

- **Verify assumptions**: Asked Claude to audit dependencies and build outputs to ensure no bloat
  - *"Do we have unnecessary stuff in node_modules?" → confirmed all 93MB are dev-only dependencies*

- **Let Claude organize**: When code or tests felt messy, asked for reorganization suggestions
  - Moved all test files to dedicated `tests/` directory for cleaner structure
