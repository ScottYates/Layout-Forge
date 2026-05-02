# Layout Forge

Layout Forge is a powerful layout editor that allows you to overlay images and iframes on a background, with full move and resize capabilities, local persistence, and import/export functionality. It's designed for stability, especially for long-running displays.

## Features

- **Dynamic Overlays**: Add images or websites as resizable and movable overlays.
- **Backgrounds**: Set static images or YouTube videos as your workspace background.
- **Persistence**: Automatically saves your layout to local storage.
- **Import/Export**: Export your configuration as JSON and import it back later.
- **Bookmarkable**: Generate a unique URL that contains your entire configuration.
- **Smart Refresh**:
  - **Soft Refresh**: Reloads all content (iframes/images) without a full page reload, preserving full-screen mode.
  - **Hard Refresh**: Full page reload option.
  - **Configurable Interval**: Set the refresh interval from 1 to 168 hours.
- **Auto-Hide Cursor**: The mouse cursor automatically hides after 5 seconds of inactivity.
- **Full Screen Support**: Persistent full-screen intent across refreshes (when possible by browser).

## Prerequisites

- **Node.js**: Version 18 or higher.
- **npm**: Version 9 or higher.

## Installation

1. **Clone or Download**: Ensure you have the source files in your desired directory.
2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Getting Started

### Development Mode

To start the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Linting

To check for TypeScript errors:

```bash
npm run lint
```

### Building for Production

To create a production-ready build in the `dist` folder:

```bash
npm run build
```

### Preview Production Build

To preview the built application locally:

```bash
npm run preview
```

## Configuration

The application state (overlays, background, UI settings) is stored in a JSON format. You can view or manually edit this configuration clicking the `JSON` icon in the toolbar.

### AppState Structure

```typescript
export interface AppState {
  backgroundType: ContentType;
  backgroundSrc: string;
  overlays: OverlayItem[];
  showUI?: boolean;
  isFullScreen?: boolean;
  refreshIntervalHours?: number;
  useSoftRefresh?: boolean;
}
```

## Contributing

Feel free to modify and adapt Layout Forge for your specific needs.

## License

This project is open-source and free to use.
