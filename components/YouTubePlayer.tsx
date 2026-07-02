import React, { useEffect, useRef, useState } from 'react';
import { YouTubeQuality } from '../types';
import { loadYouTubeApi } from '../utils/helpers';

interface YouTubePlayerProps {
  videoId: string;
  /** When the user's quality selection changes (or YT auto-downgrades), notify the caller. */
  onQualityChange?: (quality: YouTubeQuality) => void;
  /** Externally-controlled quality. The component will call setPlaybackQuality on changes. */
  quality?: YouTubeQuality;
  /** Optional className for the wrapper div. */
  className?: string;
  /** Optional inline style for the wrapper div. */
  style?: React.CSSProperties;
  /** ARIA label / title for the iframe. */
  title?: string;
  /** Whether the iframe should be clickable (e.g. for selected overlays). */
  interactive?: boolean;
}

/**
 * YouTubePlayer — wraps YouTube's IFrame Player API.
 *
 * Why the API and not just URL params?
 *   The `vq` URL param is a hint only and is largely ignored on modern
 *   embeds. To *force* a quality, you must use the IFrame Player API's
 *   `setPlaybackQuality(suggestedQuality)`. We also listen for
 *   `onPlaybackQualityChange` so we can keep our stored state in sync if
 *   YouTube downgrades (e.g. user picks 1080p but only 720p is available).
 *
 * Lifecycle:
 *   1. Load the iframe_api script (cached, loads once).
 *   2. Construct a YT.Player bound to a div.
 *   3. On `onReady`, apply the requested quality.
 *   4. On `quality` prop change, push it to the player.
 *   5. On `videoId` change, load the new video.
 *   6. On unmount, destroy the player.
 *
 * Note: the player is muted + autoplay at the URL level (see helpers.ts) so
 * Layout Forge's existing "background ambient video" use case keeps working.
 */
export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  quality,
  onQualityChange,
  className,
  style,
  title = 'YouTube video',
  interactive = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  // Tracks the most recent quality we successfully applied. Used to dedupe
  // the `onQualityChange` callback when YT echoes the same value back.
  const lastAppliedRef = useRef<string | null>(null);
  // True once the iframe_api script has loaded (or failed). Until then we
  // render a plain iframe so the user sees something instead of a blank box.
  const [apiReady, setApiReady] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);

  // Stable callback ref so changing identity doesn't tear down the player.
  const onQualityChangeRef = useRef(onQualityChange);
  useEffect(() => {
    onQualityChangeRef.current = onQualityChange;
  }, [onQualityChange]);

  // 1) Load the API once.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi()
      .then(() => {
        if (!cancelled) setApiReady(true);
      })
      .catch((err) => {
        console.warn('YouTube IFrame API failed to load, falling back to plain iframe.', err);
        if (!cancelled) setApiFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2+3+4+5+6) Construct the player when API is ready; tear down on unmount
  // or videoId change.
  useEffect(() => {
    if (!apiReady || !containerRef.current) return;

    const player = new window.YT!.Player(containerRef.current, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: interactive ? 1 : 0,
        loop: 1,
        playlist: videoId,
        playsinline: 1,
        rel: 0,
        // Hint quality at construction time (YT may still downgrade).
        ...(quality && quality !== 'auto' ? { vq: quality } : {}),
        // The API loader sets origin/enablejsapi via URL params in helpers.ts.
        // YT.Player picks those up automatically when it builds the iframe.
      },
      events: {
        onReady: (event) => {
          // Apply the requested quality as soon as the player is ready.
          // If the requested quality isn't available, YT will pick the nearest
          // match and fire onPlaybackQualityChange — we propagate that to the
          // caller via onQualityChange so the UI reflects reality.
          const q = quality || 'auto';
          try {
            event.target.setPlaybackQuality(q);
            lastAppliedRef.current = q;
          } catch (err) {
            console.warn('setPlaybackQuality failed on ready', err);
          }
          // Start muted autoplay (background-style).
          try {
            event.target.mute();
            event.target.playVideo();
          } catch {
            /* ignore autoplay restrictions */
          }
        },
        onPlaybackQualityChange: (event) => {
          // YT (or the user) changed the effective quality. Sync our state.
          // For this event, event.data is a string (the new quality level),
          // unlike onStateChange where it's a number.
          const actual = String(event.data);
          if (actual && actual !== lastAppliedRef.current) {
            lastAppliedRef.current = actual;
            onQualityChangeRef.current?.(actual as YouTubeQuality);
          }
        },
        onError: (event) => {
          console.warn('YouTube player error', event.data);
        },
      },
    });

    playerRef.current = player;

    return () => {
      try {
        player.destroy();
      } catch {
        /* ignore */
      }
      if (playerRef.current === player) {
        playerRef.current = null;
      }
    };
    // We intentionally exclude `quality` from this effect's deps. Quality
    // changes are handled by a separate effect below so we don't tear down
    // and rebuild the player every time the user nudges the dropdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId, interactive]);

  // 4) Push quality changes from props into the running player.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !apiReady) return;
    const target = quality || 'auto';
    if (lastAppliedRef.current === target) return;
    try {
      player.setPlaybackQuality(target);
      lastAppliedRef.current = target;
    } catch (err) {
      console.warn('setPlaybackQuality failed on prop change', err);
    }
  }, [quality, apiReady]);

  // Fallback: API failed to load (offline / blocked). Render a plain iframe
  // with the URL param hint so the video still plays.
  if (apiFailed) {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      controls: interactive ? '1' : '0',
      loop: '1',
      playlist: videoId,
      playsinline: '1',
      rel: '0',
    });
    if (quality && quality !== 'auto') params.set('vq', quality);
    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?${params.toString()}`}
        className={className}
        style={style}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      // YT.Player will replace this div's contents with an iframe.
      // pointer-events stay on the overlay element so dragging/resizing still works.
    />
  );
};

export default YouTubePlayer;