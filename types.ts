export enum ContentType {
  IMAGE = 'IMAGE',
  IFRAME = 'IFRAME',
  YOUTUBE = 'YOUTUBE',
}

// YouTube playback quality levels exposed by the IFrame Player API.
// 'auto' lets YouTube pick based on network/bandwidth.
// Note: YouTube may downgrade if the requested quality isn't available
// (e.g. asking for 1080p on a 720p-only stream). When that happens, the
// IFrame API fires 'onPlaybackQualityChange' so we can resync our state.
export type YouTubeQuality =
  | 'auto'
  | 'highres'   // 8K / 4K (when available)
  | 'hd2160'    // 2160p (4K)
  | 'hd1440'    // 1440p (QHD)
  | 'hd1080'    // 1080p (Full HD)
  | 'hd720'     // 720p (HD)
  | 'large'     // 480p
  | 'medium'    // 360p
  | 'small'     // 240p
  | 'default';  // YouTube's "default" tier (the lowest the API accepts)

export const YOUTUBE_QUALITY_OPTIONS: { value: YouTubeQuality; label: string; description: string }[] = [
  { value: 'auto',   label: 'Auto',          description: 'Let YouTube pick based on bandwidth' },
  { value: 'highres', label: 'Maximum',       description: 'Highest available (up to 4K/8K)' },
  { value: 'hd2160', label: '2160p (4K)',    description: 'Ultra HD' },
  { value: 'hd1440', label: '1440p (QHD)',   description: 'Quad HD' },
  { value: 'hd1080', label: '1080p (HD)',    description: 'Full HD' },
  { value: 'hd720',  label: '720p (HD)',     description: 'HD' },
  { value: 'large',  label: '480p',          description: 'Standard' },
  { value: 'medium', label: '360p',          description: 'Medium' },
  { value: 'small',  label: '240p',          description: 'Low' },
  { value: 'default', label: 'Default',       description: 'Lowest tier YouTube API accepts' },
];

export const DEFAULT_YOUTUBE_QUALITY: YouTubeQuality = 'auto';

export interface OverlayItem {
  id: string;
  type: ContentType;
  src: string; // URL or Data URI
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  opacity: number;
  refreshInterval?: number; // In seconds
  youtubeQuality?: YouTubeQuality; // Per-overlay YouTube quality (overrides global default)
}

export interface AppState {
  backgroundType: ContentType;
  backgroundSrc: string;
  overlays: OverlayItem[];
  showUI?: boolean;
  isFullScreen?: boolean;
  refreshIntervalHours?: number;
  useSoftRefresh?: boolean;
  defaultYoutubeQuality?: YouTubeQuality; // Global default for YouTube playback
}

export const DEFAULT_WIDTH = 200;
export const DEFAULT_HEIGHT = 150;