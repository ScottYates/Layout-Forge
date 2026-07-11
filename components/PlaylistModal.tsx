import React, { useEffect, useState } from 'react';
import { X, ListVideo, Play, Pause, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  MIN_BACKGROUND_ROTATION_SECONDS,
  MAX_BACKGROUND_ROTATION_SECONDS,
} from '../types';
import { getYouTubeId } from '../utils/helpers';

interface PlaylistModalProps {
  isOpen: boolean;
  initialPlaylist: string[];
  initialCyclingEnabled: boolean;
  initialRotationSeconds: number;
  onApply: (rawText: string, enabled: boolean, seconds: number) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  // Toggle cycling without closing the modal — handy for live previewing.
  onToggleCycling: () => void;
}

/**
 * Modal for entering a list of YouTube URLs/IDs to cycle through as the
 * background, plus the rotation interval and on/off toggle.
 *
 * The textarea is the source of truth while the modal is open. The user
 * types raw text (one URL or ID per line), sees a live validation summary,
 * and clicks "Apply" to push it into the app. We don't try to be clever
 * with per-line editing — that would conflict with the textarea's natural
 * UX. The text version of the playlist is what the user actually sees, so
 * re-opening the modal shows them their raw input.
 */
export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  initialPlaylist,
  initialCyclingEnabled,
  initialRotationSeconds,
  onApply,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  onToggleCycling,
}) => {
  // Convert the stored list of IDs back into the user's preferred text
  // representation. If the original was a mix of URLs and IDs we can't
  // reconstruct that, so we just show the IDs.
  const idsToText = (ids: string[]): string => ids.join('\n');

  const [text, setText] = useState<string>(idsToText(initialPlaylist));
  const [enabled, setEnabled] = useState<boolean>(initialCyclingEnabled);
  const [seconds, setSeconds] = useState<number>(initialRotationSeconds);

  // Re-seed local state when the modal opens. We only re-seed on the
  // open→close→open cycle, not on every prop change, so the user can
  // keep typing without their input being clobbered by the rotation tick.
  useEffect(() => {
    if (isOpen) {
      setText(idsToText(initialPlaylist));
      setEnabled(initialCyclingEnabled);
      setSeconds(initialRotationSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // Live validation: parse the textarea line-by-line and bucket each line
  // as valid (recognized as a YouTube URL or 11-char ID) or invalid.
  const lines = text.split(/\r?\n/);
  const validIds: string[] = [];
  const invalidLines: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const id = getYouTubeId(trimmed) || (/^[A-Za-z0-9_-]{11}$/.test(trimmed) ? trimmed : null);
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
      validIds.push(id);
    } else {
      invalidLines.push(trimmed);
    }
  }

  const totalEntries = validIds.length + invalidLines.length;
  const isRotationValid =
    Number.isFinite(seconds) &&
    seconds >= MIN_BACKGROUND_ROTATION_SECONDS &&
    seconds <= MAX_BACKGROUND_ROTATION_SECONDS;

  const canApply = isRotationValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canApply) return;
    // Push the raw text — the parent's parsePlaylistInput handles the
    // dedup + filtering, so we don't need to re-parse here.
    onApply(text, enabled, seconds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ListVideo className="text-blue-400" />
            Background YouTube Cycling
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Paste a list of YouTube URLs or video IDs (one per line). The background
          will rotate through them in order. Full <code>youtube.com/watch?v=...</code>,
          short <code>youtu.be/...</code>, embed, and raw 11-char IDs are all accepted.
        </p>

        {/* URL list */}
        <div className="flex-1 min-h-0 mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={`https://www.youtube.com/watch?v=XXXXXXXXXXX\nhttps://youtu.be/YYYYYYYYYYY\nZZZZZZZZZZZ`}
            className="w-full h-48 bg-slate-950 font-mono text-xs text-slate-200 p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Validation summary */}
        <div className="text-xs flex flex-col gap-1 mb-4">
          {totalEntries === 0 ? (
            <span className="text-slate-500">No entries yet — paste URLs above to get started.</span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-green-400">
                <CheckCircle2 size={14} />
                {validIds.length} valid {validIds.length === 1 ? 'entry' : 'entries'}
                {validIds.length > 0 && currentIndex >= 0 && currentIndex < validIds.length && enabled && (
                  <span className="text-slate-500 ml-2">
                    (currently playing #{currentIndex + 1})
                  </span>
                )}
              </span>
              {invalidLines.length > 0 && (
                <span className="flex items-start gap-1.5 text-amber-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {invalidLines.length} {invalidLines.length === 1 ? 'line' : 'lines'} couldn't be parsed:{' '}
                    <span className="text-amber-300/80 font-mono break-all">
                      {invalidLines.slice(0, 3).join(', ')}
                      {invalidLines.length > 3 && `, +${invalidLines.length - 3} more`}
                    </span>
                  </span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Cycling controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {/* Enable toggle */}
          <label className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer hover:border-slate-600">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                // Mirror immediately to the running app so the user can see
                // the toggle take effect without closing the modal.
                if (e.target.checked !== initialCyclingEnabled) onToggleCycling();
              }}
              className="w-4 h-4 accent-blue-500"
            />
            <div className="flex flex-col">
              <span className="text-sm text-white font-medium flex items-center gap-1.5">
                {enabled ? <Pause size={14} className="text-blue-400" /> : <Play size={14} className="text-slate-400" />}
                Cycling {enabled ? 'enabled' : 'disabled'}
              </span>
              <span className="text-[11px] text-slate-500">
                {enabled ? 'Background rotates through the list.' : 'Background shows the first entry only.'}
              </span>
            </div>
          </label>

          {/* Rotation interval */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
            <label htmlFor="rotation-seconds" className="text-sm text-white font-medium flex-1">
              Rotate every
            </label>
            <input
              id="rotation-seconds"
              type="number"
              min={MIN_BACKGROUND_ROTATION_SECONDS}
              max={MAX_BACKGROUND_ROTATION_SECONDS}
              value={seconds}
              onChange={(e) => setSeconds(parseInt(e.target.value || '0', 10))}
              className="w-20 bg-slate-950 border border-slate-700 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            />
            <span className="text-sm text-slate-400">sec</span>
          </div>
        </div>

        {seconds < MIN_BACKGROUND_ROTATION_SECONDS && (
          <div className="text-xs text-amber-400 mb-3 -mt-2">
            Minimum rotation interval is {MIN_BACKGROUND_ROTATION_SECONDS} seconds.
          </div>
        )}
        {seconds > MAX_BACKGROUND_ROTATION_SECONDS && (
          <div className="text-xs text-amber-400 mb-3 -mt-2">
            Maximum rotation interval is {MAX_BACKGROUND_ROTATION_SECONDS} seconds (24h).
          </div>
        )}

        {/* Manual prev/next (for testing) */}
        {validIds.length > 1 && (
          <div className="flex items-center gap-2 mb-5 text-xs text-slate-400">
            <span>Manual:</span>
            <button
              type="button"
              onClick={onPrev}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors"
            >
              <ChevronRight size={14} /> Next
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canApply}
            className={`px-6 py-2 rounded-lg transition-colors font-bold shadow-lg ${
              canApply
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Apply
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlaylistModal;