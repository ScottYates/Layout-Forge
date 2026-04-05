export enum ContentType {
  IMAGE = 'IMAGE',
  IFRAME = 'IFRAME',
  YOUTUBE = 'YOUTUBE',
}

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
}

export interface AppState {
  backgroundType: ContentType;
  backgroundSrc: string;
  overlays: OverlayItem[];
  showUI?: boolean;
  isFullScreen?: boolean;
}

export const DEFAULT_WIDTH = 200;
export const DEFAULT_HEIGHT = 150;