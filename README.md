# Bezier Curve Playground

An interactive web application for creating, editing, and visualizing Bezier curves with multiple visualization modes and animation capabilities.

## Live Demo

🚀 [View on Vercel](#) *(Deploy and update this link)*

## Features

- **Interactive Control Points**: Click to add, drag to move, right-click to delete control points
- **Multiple Curves**: Create and manage multiple Bezier curves with different colors
- **Undo/Redo**: Full history support with keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z)
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

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bezier

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173/`

### Build for Production

```bash
npm run build
npm run preview
```

## Usage

### Basic Controls

- **Add Point**: Click anywhere on the canvas
- **Move Point**: Click and drag a control point
- **Delete Point**: Right-click on a control point
- **Undo/Redo**: Use buttons or keyboard shortcuts

### Keyboard Shortcuts

- `Ctrl+Z` (or `Cmd+Z` on Mac): Undo
- `Ctrl+Shift+Z` (or `Cmd+Shift+Z` on Mac): Redo
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
- **Load JSON**: Import curves from a JSON file (supports both single curve and multiple curves format)
- **Export SVG**: Export the active curve as an SVG file
- **Drag & Drop**: Drag a JSON file onto the canvas to load it

### JSON Format

**Multiple curves:**
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

**Single curve (legacy):**
```json
{
  "points": [
    { "x": 100, "y": 200 },
    { "x": 300, "y": 100 }
  ]
}
```

## Project Structure

```
bezier/
├── src/
│   ├── animation.ts      # Animation loop and progress management
│   ├── bezier.ts         # De Casteljau algorithm and curve evaluation
│   ├── curveManager.ts   # Multiple curve state management
│   ├── fileUtils.ts      # JSON validation utilities
│   ├── history.ts        # Undo/redo history management
│   ├── interaction.ts    # Mouse event handling
│   ├── main.ts           # Application entry point and UI coordination
│   ├── renderer.ts       # Canvas rendering logic
│   └── types.ts          # TypeScript type definitions
├── index.html            # HTML structure and styling
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── eslint.config.js      # ESLint configuration
└── vercel.json           # Vercel deployment configuration
```

## Development

### Code Quality

This project enforces strict code quality standards:

- **File Size Limit**: No file should exceed 500 lines of code
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier with automatic formatting
- **Type Safety**: Strict TypeScript configuration

### Hooks

The project uses custom hooks (`.claude/hooks/`) for automated checks on file edits.

## License

MIT
