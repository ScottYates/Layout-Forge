import { YouTubeQuality } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const getYouTubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const isImageUrl = (url: string): boolean => {
  if (url.startsWith('data:image')) return true;
  return /\.(jpeg|jpg|gif|png|webp|svg|bmp)$/i.test(url.split('?')[0]);
};

/**
 * Build a YouTube embed URL.
 *
 * - `enableJsApi=true` adds `enablejsapi=1` + a matching `origin` so the
 *   IFrame Player API can drive the player (needed for setPlaybackQuality).
 *   The current page's `window.location.origin` is required — without it
 *   YouTube throws Error 153.
 * - `quality` (optional) suggests a starting quality via the legacy `vq` param.
 *   Modern YouTube largely ignores `vq`, but we keep it as a hint and rely on
 *   the Player API's `setPlaybackQuality()` for actual control.
 */
export const getYouTubeEmbedUrl = (
  videoId: string,
  options: { quality?: YouTubeQuality; enableJsApi?: boolean } = {},
): string => {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: videoId,
    playsinline: '1',
    rel: '0',
  });

  if (options.quality && options.quality !== 'auto') {
    params.set('vq', options.quality);
  }

  if (options.enableJsApi) {
    params.set('enablejsapi', '1');
    // Error 153 fix: origin must match the embedder. Skip on file:// / opaque
    // origins where YouTube will reject the API call — the iframe still plays.
    const origin =
      typeof window !== 'undefined' && window.location?.origin?.startsWith('http')
        ? window.location.origin
        : '';
    if (origin) {
      params.set('origin', origin);
    }
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

export const downloadJson = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// --- YouTube IFrame Player API loader ---
//
// Loads https://www.youtube.com/iframe_api once. Subsequent calls return the
// same promise. The API exposes `window.YT.Player` once loaded.

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
  // Minimal subset of the IFrame Player API surface we touch. The full API has
  // many more methods — we only model what we actually use so types stay small.
  // See https://developers.google.com/youtube/iframe_api_reference
  namespace YT {
    interface PlayerOptions {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: { [key: string]: any };
      events?: {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: PlayerEvent) => void;
        onPlaybackQualityChange?: (event: PlayerEvent) => void;
        onError?: (event: PlayerEvent) => void;
      };
    }
    interface PlayerEvent {
      target: Player;
      data?: number;
    }
    interface Player {
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      mute(): void;
      unMute(): void;
      isMuted(): boolean;
      loadVideoById(videoId: string): void;
      cueVideoById(videoId: string): void;
      setPlaybackQuality(suggestedQuality: string): void;
      getPlaybackQuality(): string;
      getAvailableQualityLevels(): string[];
      setSize(width: number | string, height: number | string): void;
      destroy(): void;
      getIframe(): HTMLIFrameElement;
    }
    class Player {
      constructor(elementId: HTMLElement | string, options: PlayerOptions);
    }
  }
}

let apiLoadPromise: Promise<typeof YT> | null = null;

export const loadYouTubeApi = (): Promise<typeof YT> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window not available'));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve, reject) => {
    // The API calls window.onYouTubeIframeAPIReady when it's done loading.
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube IFrame API loaded but window.YT is undefined'));
      }
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => {
      apiLoadPromise = null;
      reject(new Error('Failed to load YouTube IFrame API'));
    };
    document.head.appendChild(tag);
  });

  return apiLoadPromise;
};