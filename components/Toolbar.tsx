import React, { useRef } from 'react';
import {
  Download,
  Upload,
  Plus,
  Image as ImageIcon,
  Globe,
  Monitor,
  Settings,
  Trash,
  EyeOff,
  Maximize,
  Minimize,
  Link,
  FileJson,
  Bookmark,
  Youtube,
  MonitorPlay,
  ListVideo,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
} from 'lucide-react';
import { fileToDataUri } from '../utils/helpers';
import {
  ContentType,
  OverlayItem,
  YouTubeQuality,
  YOUTUBE_QUALITY_OPTIONS,
} from '../types';

interface ToolbarProps {
  currentBackground: { type: ContentType, src: string };
  onAddOverlay: (type: ContentType, src: string) => void;
  onSetBackground: (type: ContentType, src: string) => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onClear: () => void;
  onOpenUrlModal: (title: string, callback: (src: string) => void, defaultValue?: string) => void;
  onOpenConfigModal: () => void;
  onHideUI: () => void;
  onToggleFullScreen: () => void;
  onBookmark: () => void;
  isFullScreen: boolean;
  refreshIntervalHours: number;
  onSetRefreshInterval: (hours: number) => void;
  useSoftRefresh: boolean;
  onToggleSoftRefresh: () => void;
  defaultYoutubeQuality: YouTubeQuality;
  onSetDefaultYoutubeQuality: (q: YouTubeQuality) => void;
  onApplyDefaultQualityToOverlays: () => void;
  showYouTubeNativeControls: boolean;
  onToggleYouTubeNativeControls: () => void;
  // Background YouTube cycling
  backgroundPlaylist: string[];
  backgroundCyclingEnabled: boolean;
  backgroundRotationSeconds: number;
  backgroundPlaylistIndex: number;
  onOpenPlaylistModal: () => void;
  onPlaylistNext: () => void;
  onPlaylistPrev: () => void;
  onToggleCycling: () => void;
}

const BTN_PRIMARY = "flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-2 rounded-md transition-all active:scale-95 border border-slate-600 cursor-pointer";
const BTN_SECONDARY = "flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-md transition-all active:scale-95 border border-slate-700 cursor-pointer";

export const Toolbar: React.FC<ToolbarProps> = ({
  currentBackground,
  onAddOverlay,
  onSetBackground,
  onSave,
  onLoad,
  onClear,
  onOpenUrlModal,
  onOpenConfigModal,
  onHideUI,
  onToggleFullScreen,
  onBookmark,
  isFullScreen,
  refreshIntervalHours,
  onSetRefreshInterval,
  useSoftRefresh,
  onToggleSoftRefresh,
  defaultYoutubeQuality,
  onSetDefaultYoutubeQuality,
  onApplyDefaultQualityToOverlays,
  showYouTubeNativeControls,
  onToggleYouTubeNativeControls,
  backgroundPlaylist,
  backgroundCyclingEnabled,
  backgroundRotationSeconds,
  backgroundPlaylistIndex,
  onOpenPlaylistModal,
  onPlaylistNext,
  onPlaylistPrev,
  onToggleCycling,
}) => {
  const bgInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const uri = await fileToDataUri(e.target.files[0]);
      onSetBackground(ContentType.IMAGE, uri);
    }
    // Reset
    if (bgInputRef.current) bgInputRef.current.value = '';
  };

  const handleOverlayUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      for (let i = 0; i < e.target.files.length; i++) {
        const uri = await fileToDataUri(e.target.files[i]);
        onAddOverlay(ContentType.IMAGE, uri);
      }
    }
    if (overlayInputRef.current) overlayInputRef.current.value = '';
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onLoad(e.target.files[0]);
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const getBackgroundUrlDefault = () => {
    if (currentBackground.type === ContentType.YOUTUBE) {
      return `https://www.youtube.com/watch?v=${currentBackground.src}`;
    }
    if (currentBackground.type === ContentType.IFRAME || currentBackground.type === ContentType.IMAGE) {
      // Don't pre-fill if it's a massive data URI
      if (currentBackground.src.startsWith('data:')) return '';
      return currentBackground.src;
    }
    return '';
  };

  return (
    <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-4 justify-between select-none shadow-md z-50 relative">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
          <Settings className="text-blue-400" /> Layout Forge
        </h1>
        
        <div className="h-8 w-px bg-slate-600 mx-2"></div>

        {/* Background Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Background</span>
          <button 
            onClick={() => bgInputRef.current?.click()}
            className={BTN_SECONDARY}
            title="Set Background Image"
          >
            <ImageIcon size={18} />
          </button>
          <button 
            onClick={() => onOpenUrlModal(
              "Set Background Web Page", 
              (url) => onSetBackground(ContentType.IFRAME, url),
              getBackgroundUrlDefault()
            )}
            className={BTN_SECONDARY}
            title="Set Background URL"
          >
            <Globe size={18} />
          </button>
          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
        </div>

        <div className="h-8 w-px bg-slate-600 mx-2"></div>

        {/* Overlay Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Overlays</span>
          <button 
            onClick={() => overlayInputRef.current?.click()}
            className={BTN_PRIMARY}
            title="Add Image Overlay"
          >
            <Plus size={18} /> <ImageIcon size={18} />
          </button>
          <button 
            onClick={() => onOpenUrlModal("Add Web Image Overlay", (url) => onAddOverlay(ContentType.IMAGE, url))}
            className={BTN_PRIMARY}
            title="Add Web Image Overlay"
          >
             <Plus size={18} /> <Link size={18} />
          </button>
          <button 
            onClick={() => onOpenUrlModal("Add Web Page Overlay", (url) => onAddOverlay(ContentType.IFRAME, url))}
            className={BTN_PRIMARY}
            title="Add Website Overlay"
          >
            <Plus size={18} /> <Monitor size={18} />
          </button>
          <input ref={overlayInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleOverlayUpload} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleFullScreen}
          className="text-slate-400 hover:text-white hover:bg-slate-700/50 p-2 rounded-md transition-colors flex items-center gap-2"
          title="Toggle Full Screen"
        >
          {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
        <button 
          onClick={onHideUI}
          className="text-slate-400 hover:text-white hover:bg-slate-700/50 p-2 rounded-md transition-colors flex items-center gap-2"
          title="Hide Toolbar & Status"
        >
          <EyeOff size={18} />
        </button>

        <div className="h-8 w-px bg-slate-600 mx-2"></div>

        <button 
          onClick={onClear}
          className="text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Trash size={16} /> <span className="hidden sm:inline">Clear</span>
        </button>
        
        <button 
          onClick={() => importInputRef.current?.click()}
          className="text-slate-300 hover:text-white hover:bg-slate-700 px-3 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Upload size={16} /> <span className="hidden sm:inline">Import</span>
        </button>
        <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

        <button 
          onClick={onSave}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md transition-colors shadow-lg flex items-center gap-2 font-medium cursor-pointer"
        >
          <Download size={16} /> Export
        </button>
        
        <button 
          onClick={onOpenConfigModal}
          className="text-slate-300 hover:text-white hover:bg-slate-700 px-3 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
          title="View/Edit Configuration JSON"
        >
          <FileJson size={16} />
        </button>

         <button 
          onClick={onBookmark}
          className="text-slate-300 hover:text-white hover:bg-slate-700 px-3 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
          title="Update URL to Bookmark Configuration"
        >
          <Bookmark size={16} />
        </button>

        <div className="h-8 w-px bg-slate-600 mx-1"></div>

        <div className="flex items-center gap-2 px-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 leading-none">Refresh<br/>(Hours)</span>
          <input 
            type="number" 
            min="1" 
            max="168"
            value={refreshIntervalHours}
            onChange={(e) => onSetRefreshInterval(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 bg-slate-900 border border-slate-700 text-white text-xs rounded px-1 py-1 focus:outline-none focus:border-blue-500"
            title="Hard refresh interval in hours"
          />
        </div>

        <div className="flex items-center gap-2 px-2 border-l border-slate-700">
           <button
             onClick={onToggleSoftRefresh}
             className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${useSoftRefresh ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
             title={useSoftRefresh ? "Soft Refresh: Reloads content without page reload (preserves full-screen)" : "Hard Refresh: Full page reload (exits full-screen)"}
           >
             {useSoftRefresh ? 'Soft' : 'Hard'}
           </button>
        </div>

        {/* YouTube Quality — applies to background & new overlays, with a
            one-click "push to existing overlays" affordance. */}
        <div className="flex items-center gap-1 px-2 border-l border-slate-700" title="Default YouTube playback quality">
          <Youtube size={16} className="text-red-400" />
          <select
            value={defaultYoutubeQuality}
            onChange={(e) => onSetDefaultYoutubeQuality(e.target.value as YouTubeQuality)}
            className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-1 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
            aria-label="Default YouTube playback quality"
          >
            {YOUTUBE_QUALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={onApplyDefaultQualityToOverlays}
            className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title="Apply current default to all YouTube overlays that don't have their own override"
          >
            Apply All
          </button>
          <button
            onClick={onToggleYouTubeNativeControls}
            className={`flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${
              showYouTubeNativeControls
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
            title={
              showYouTubeNativeControls
                ? 'Hide YouTube IFrame native controls (play bar, quality menu, etc.)'
                : 'Show YouTube IFrame native controls — useful for verifying the actual quality YouTube is serving via its quality menu'
            }
            aria-pressed={showYouTubeNativeControls}
          >
            <MonitorPlay size={12} />
            YT Controls
          </button>
        </div>

        {/* Background YouTube Cycling — opens the modal to manage the list
            and rotation interval. When a list is present, show position +
            manual prev/next so the user can step through without waiting
            for the timer. */}
        <div className="flex items-center gap-1 px-2 border-l border-slate-700">
          <button
            onClick={onOpenPlaylistModal}
            className={`flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${
              backgroundCyclingEnabled
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : backgroundPlaylist.length > 0
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
            }`}
            title={
              backgroundPlaylist.length === 0
                ? 'Set up a list of YouTube videos to cycle through as the background'
                : backgroundCyclingEnabled
                ? `Cycling ${backgroundPlaylistIndex + 1}/${backgroundPlaylist.length} — every ${backgroundRotationSeconds}s. Click to edit.`
                : `${backgroundPlaylist.length} video${backgroundPlaylist.length === 1 ? '' : 's'} ready, cycling is paused. Click to edit.`
            }
            aria-pressed={backgroundCyclingEnabled}
          >
            <ListVideo size={12} />
            {backgroundPlaylist.length === 0
              ? 'Playlist'
              : backgroundCyclingEnabled
              ? `${backgroundPlaylistIndex + 1}/${backgroundPlaylist.length}`
              : `${backgroundPlaylist.length} ready`}
          </button>
          {backgroundCyclingEnabled && backgroundPlaylist.length > 1 && (
            <>
              <button
                onClick={onToggleCycling}
                className="flex items-center text-[10px] uppercase font-bold px-1.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                title="Pause cycling (stays on the current video)"
                aria-label="Pause cycling"
              >
                <Pause size={12} />
              </button>
              <button
                onClick={onPlaylistPrev}
                className="flex items-center text-[10px] uppercase font-bold px-1.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                title="Previous video (manual — doesn't reset the timer)"
                aria-label="Previous video"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                onClick={onPlaylistNext}
                className="flex items-center text-[10px] uppercase font-bold px-1.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                title="Next video (manual — doesn't reset the timer)"
                aria-label="Next video"
              >
                <ChevronRight size={12} />
              </button>
            </>
          )}
          {!backgroundCyclingEnabled && backgroundPlaylist.length > 0 && (
            <button
              onClick={onToggleCycling}
              className="flex items-center text-[10px] uppercase font-bold px-1.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              title="Resume cycling"
              aria-label="Resume cycling"
            >
              <Play size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};