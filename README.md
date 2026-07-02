# Layout Forge

Layout Forge is a powerful layout editor that allows you to overlay images and iframes on a background, with full move and resize capabilities, local persistence, and import/export functionality. It's designed for stability, especially for long-running displays.

## Features

- **Dynamic Overlays**: Add images or websites as resizable and movable overlays.
- **Backgrounds**: Set static images or YouTube videos as your workspace background.
- **YouTube Quality Control**: Pick the playback quality for the YouTube background and any YouTube overlay — from 144p up to 4K/8K, or let YouTube decide automatically.
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

## Server Deployment

Because Layout Forge is a client-side Single Page Application (SPA), deploying to a production server requires building the static files and serving them.

### 1. Build the Application
```bash
npm run build
```
This generates a `dist` folder containing your optimized production files.

### 2. Serve the Static Files

You can use a simple static server like `serve`, or configure Nginx/Apache.

**Using `serve`:**
Install `serve` globally:
```bash
npm install -g serve
```
Run the application on port 3000:
```bash
serve -s dist -l 3000
```
*(The `-s` flag tells it to serve as a Single Page Application, routing all requests to `index.html`)*

### 3. Setting Up a systemd Service (Linux)

To ensure your application runs continuously and restarts on server reboot, set up a Systemd service file.

1. Create a service file at `/etc/systemd/system/layout-forge.service`:
   ```bash
   sudo nano /etc/systemd/system/layout-forge.service
   ```

2. Add the following content (update the paths and user to match your setup):
   ```ini
   [Unit]
   Description=Layout Forge Service
   After=network.target
   
   [Service]
   Type=simple
   User=your_username
   Group=your_group
   WorkingDirectory=/path/to/layout-forge
   # Make sure `serve` is in the user's PATH, or provide an absolute path to the global `serve` binary:
   ExecStart=/usr/bin/env serve -s dist -l 3000
   Restart=on-failure
   RestartSec=10
   
   [Install]
   WantedBy=multi-user.target
   ```

3. Reload systemd, enable, and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable layout-forge.service
   sudo systemctl start layout-forge.service
   ```

4. Check the status:
   ```bash
   sudo systemctl status layout-forge.service
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
  defaultYoutubeQuality?: YouTubeQuality; // Global default YouTube quality
}
```

## YouTube Quality Control

YouTube doesn't honor the `vq` URL parameter on modern embeds, so Layout
Forge uses the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
to drive playback quality.

- **Toolbar** has a YouTube-quality dropdown (red YouTube icon). This sets the
  *global default* — used for the background video and any new YouTube overlays
  you create. The "Apply All" button next to it pushes that default onto every
  existing YouTube overlay that doesn't already have a per-overlay override.
- **Per-overlay**: select a YouTube overlay to expose a quality dropdown in
  its top control bar. Pick a value to override the global default for that
  overlay, or pick "Default" to clear the override and inherit again.
- **Auto-downgrade detection**: if YouTube can't honor the requested quality
  (e.g. you ask for 1080p on a 720p-only stream), the player fires
  `onPlaybackQualityChange` and Layout Forge updates the stored quality to the
  actual level so the UI stays in sync with reality.

Available qualities: `auto`, `highres` (max available, up to 8K/4K), `hd2160`,
`hd1440`, `hd1080`, `hd720`, `large` (480p), `medium` (360p), `small` (240p),
`tiny` (144p).

## Contributing

Feel free to modify and adapt Layout Forge for your specific needs.

## License

This project is open-source and free to use.
