import React, { useCallback, useEffect, useRef, useState } from 'react';
import { YouTubeQuality, YOUTUBE_QUALITY_OPTIONS } from '../types';
import { loadYouTubeApi } from '../utils/helpers';

// How long the quality badge stays fully visible after the last "activity"
// (mouse move, touch, or quality change) before fading out.
const BADGE_VISIBLE_MS = 3000;
// How long the fade transition takes. Keep this in sync with the
// `duration-${BADGE_FADE_MS}` Tailwind class on the badge wrapper.
const BADGE_FADE_MS = 500;

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
  // The current desired quality, kept in a ref so the onStateChange handler
  // (which is created when the player is constructed and lives in a closure)
  // can always read the latest value. Without this, every PLAYING /
  // BUFFERING state event re-applies the *initial* quality, silently
  // reverting any change the user made via the toolbar dropdown.
  const desiredQualityRef = useRef<YouTubeQuality | undefined>(quality);
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

  // Badge visibility. Auto-fades after BADGE_VISIBLE_MS of "no activity".
  // "Activity" = a quality change OR a global mouse/touch event.
  const [badgeVisible, setBadgeVisible] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);

  // Stable callback ref so changing identity doesn't tear down the player.
  const onQualityChangeRef = useRef(onQualityChange);
  useEffect(() => {
    onQualityChangeRef.current = onQualityChange;
  }, [onQualityChange]);

  // Keep the desired quality ref in sync with the prop. The onStateChange
  // handler (created once when the player is constructed) reads from this
  // ref, so it always sees the latest user-selected value rather than the
  // stale value from its closure.
  useEffect(() => {
    desiredQualityRef.current = quality;
  }, [quality]);

  // Reveal the badge and (re)start the auto-hide timer. Safe to call from
  // anywhere — if the badge is already visible, the timer is simply reset
  // to BADGE_VISIBLE_MS from now, so continuous activity keeps it shown.
  const revealBadge = useCallback(() => {
    setBadgeVisible(true);
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setBadgeVisible(false);
      hideTimeoutRef.current = null;
    }, BADGE_VISIBLE_MS);
  }, []);

  // Whenever the actual quality changes (initial, optimistic, or YT-driven),
  // reveal the badge so the user can see what YT is serving.
  useEffect(() => {
    if (actualQuality) {
      revealBadge();
    }
  }, [actualQuality, revealBadge]);

  // Global activity listener: any mouse move or touch on the page reveals
  // the badge. We listen on `window` rather than the wrapper div because
  // the YouTube iframe swallows mouse events — events that happen *over*
  // the iframe don't bubble up to the parent. A window-level listener
  // catches the user's intent regardless of which element is under the
  // pointer. (We also drop these on touch devices, where mousemove is
  // not fired.)
  useEffect(() => {
    const onActivity = () => revealBadge();
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('touchstart', onActivity);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, [revealBadge]);

  // Cancel any pending hide timer on unmount.
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

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
          // Read from the ref, not the closure — `quality` here is the
          // value at construction time; the ref always has the latest.
          const q = desiredQualityRef.current || 'auto';
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
          //
          // We MUST read the desired quality from the ref, not the
          // closure. This handler is created once when the player is
          // constructed; if it captured the `quality` prop directly, it
          // would always apply the *initial* quality and silently revert
          // any change the user made via the toolbar dropdown. The ref is
          // updated whenever the `quality` prop changes (see the
          // useEffect above), so it always reflects the latest intent.
          const s = event.data;
          if (s === STATE_PLAYING || s === STATE_BUFFERING) {
            const q = desiredQualityRef.current || 'auto';
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
    // Same pointer-events override as the API-driven path below.
    const pointerEventsClass = interactive
      ? 'pointer-events-auto'
      : (className?.includes('pointer-events-none') ? 'pointer-events-none' : '');
    return (
      <div
        className={`${className ?? ''} ${pointerEventsClass}`.trim()}
        style={{ ...style, position: 'relative' }}
      >
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

  // Compute the wrapper's pointer-events. The `interactive` prop is the
  // single source of truth: when true, the user MUST be able to click
  // the IFrame's native controls (play bar, quality menu, etc.), so we
  // force pointer-events-auto regardless of what the caller put in
  // `className`. When false, we leave the caller's className alone —
  // typically `pointer-events-none` so the YouTube area doesn't block
  // dragging/resizing of overlays that sit on top of it.
  const pointerEventsClass = interactive
    ? 'pointer-events-auto'
    : (className?.includes('pointer-events-none') ? 'pointer-events-none' : '');

  return (
    <div
      className={`${className ?? ''} ${pointerEventsClass}`.trim()}
      style={{ ...style, position: 'relative' }}
    >
      <div
        ref={containerRef}
        // YT.Player will replace this div's contents with an iframe.
        className="w-full h-full"
      />
      {showQualityBadge && actualQuality && (
        <div
          // The wrapper handles the fade. `pointer-events-none` so the badge
          // never blocks the iframe's own interactions.
          className={`absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-0.5 transition-opacity ease-out ${
            badgeVisible ? 'opacity-100' : 'opacity-0'
          }`}
          // duration is wired to BADGE_FADE_MS so they stay in sync.
          style={{ transitionDuration: `${BADGE_FADE_MS}ms` }}
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