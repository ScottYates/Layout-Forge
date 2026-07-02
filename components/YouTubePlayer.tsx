import React, { useEffect, useRef, useState } from 'react';
import { YouTubeQuality, YOUTUBE_QUALITY_OPTIONS } from '../types';
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
  /** Whether to show the small "actual quality" badge overlay. Default true. */
  showQualityBadge?: boolean;
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
 *   4. On every `PLAYING` / `BUFFERING` state change, re-apply the quality.
 *      The IFrame API's `setPlaybackQuality` is a request that YT can
 *      silently drop if the video hasn't started yet — re-applying on
 *      state changes makes the choice stick, even for live streams and
 *      late-starting videos.
 *   5. On `quality` prop change, push it to the player.
 *   6. On `videoId` change, load the new video.
 *   7. On unmount, destroy the player.
 */
export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  quality,
  onQualityChange,
  className,
  style,
  title = 'YouTube video',
  interactive = false,
  showQualityBadge = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  // Tracks the most recent quality we successfully applied. Used to dedupe
  // calls (so we don't re-issue the same setPlaybackQuality on every render)
  // and to detect when YT echoes the same value back.
  const lastAppliedRef = useRef<string | null>(null);
  // True once the iframe_api script has loaded (or failed). Until then we
  // render a plain iframe so the user sees something instead of a blank box.
  const [apiReady, setApiReady] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  // The *actual* quality YT is currently playing, as reported by the
  // `onPlaybackQualityChange` event. We render this as a small badge so
  // the user can see what YT picked (which can be lower than what they
  // asked for, e.g. when bandwidth is limited or the source doesn't
  // support the requested tier).
  const [actualQuality, setActualQuality] = useState<YouTubeQuality | null>(null);

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

  // Helper that re-applies the requested quality. Safe to call repeatedly;
  // the lastAppliedRef guard keeps it cheap.
  const applyQuality = (player: YT.Player, q: YouTubeQuality) => {
    try {
      player.setPlaybackQuality(q);
      lastAppliedRef.current = q;
    } catch (err) {
      console.warn('setPlaybackQuality failed', err);
    }
  };

  // 2+3+4+6+7) Construct the player when API is ready; tear down on unmount
  // or videoId change.
  useEffect(() => {
    if (!apiReady || !containerRef.current) return;

    // YT.Player state constants. See:
    //   https://developers.google.com/youtube/iframe_api_reference#Events
    //  -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
    const STATE_PLAYING = 1;
    const STATE_BUFFERING = 3;

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
        // Hint quality at construction time. YT may still downgrade.
        ...(quality && quality !== 'auto' ? { vq: quality } : {}),
        // The API loader sets origin/enablejsapi via URL params in helpers.ts.
        // YT.Player picks those up automatically when it builds the iframe.
      },
      events: {
        onReady: (event) => {
          // Apply the requested quality as soon as the player is ready.
          const q = quality || 'auto';
          applyQuality(event.target, q);
          // Start muted autoplay (background-style).
          try {
            event.target.mute();
            event.target.playVideo();
          } catch {
            /* ignore autoplay restrictions */
          }
        },
        onStateChange: (event) => {
          // Re-apply the requested quality whenever the player starts
          // playing or begins buffering. This is the bit that makes
          // setPlaybackQuality "stick" for live streams and late-loaded
          // videos — the API's setPlaybackQuality is a request that YT
          // can silently drop if the video isn't ready yet, so re-issuing
          // it on state transitions catches those cases.
          const s = event.data;
          if (s === STATE_PLAYING || s === STATE_BUFFERING) {
            const q = quality || 'auto';
            applyQuality(event.target, q);
          }
        },
        onPlaybackQualityChange: (event) => {
          // YT (or the user) changed the effective quality. Sync our state.
          // For this event, event.data is a string (the new quality level),
          // unlike onStateChange where it's a number.
          const actual = String(event.data) as YouTubeQuality;
          if (actual && actual !== lastAppliedRef.current) {
            lastAppliedRef.current = actual;
            setActualQuality(actual);
            onQualityChangeRef.current?.(actual);
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
      // Clear the badge when the player is gone.
      setActualQuality(null);
    };
    // We intentionally exclude `quality` from this effect's deps. Quality
    // changes are handled by a separate effect below so we don't tear down
    // and rebuild the player every time the user nudges the dropdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId, interactive]);

  // 5) Push quality changes from props into the running player.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !apiReady) return;
    const target = quality || 'auto';
    if (lastAppliedRef.current === target) return;
    applyQuality(player, target);
    // Optimistic update so the badge reflects intent immediately, even
    // before YT fires onPlaybackQualityChange.
    setActualQuality(target);
  }, [quality, apiReady]);

  // Map a quality code to a short human label for the badge.
  const qualityLabel = (q: YouTubeQuality | null): string => {
    if (!q) return '...';
    if (q === 'auto') return 'Auto';
    const opt = YOUTUBE_QUALITY_OPTIONS.find((o) => o.value === q);
    return opt ? opt.label : q;
  };

  // The "target" (requested) quality and the "actual" (YT-reported)
  // quality can differ — show that difference in the badge so the user
  // knows when YT is downgrading.
  const requested = quality || 'auto';
  const isMismatch =
    actualQuality !== null && actualQuality !== requested && requested !== 'auto';

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
      <div className={className} style={{ ...style, position: 'relative' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?${params.toString()}`}
          className="w-full h-full border-0"
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ ...style, position: 'relative' }}>
      <div
        ref={containerRef}
        // YT.Player will replace this div's contents with an iframe.
        className="w-full h-full"
      />
      {showQualityBadge && actualQuality && (
        <div
          className="absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-0.5"
          // Tooltip explains the mismatch if YT downgraded.
          title={
            isMismatch
              ? `Requested ${qualityLabel(requested)}, YouTube is playing at ${qualityLabel(actualQuality)} (auto-downgrade).`
              : `Playing at ${qualityLabel(actualQuality)}`
          }
        >
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-md ${
              isMismatch
                ? 'bg-amber-500 text-black'
                : 'bg-black/70 text-white'
            }`}
          >
            {qualityLabel(actualQuality)}
          </span>
        </div>
      )}
    </div>
  );
};

export default YouTubePlayer;