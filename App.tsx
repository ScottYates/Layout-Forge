import React, { useState, useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { OverlayElement } from './components/OverlayElement';
import { YouTubePlayer } from './components/YouTubePlayer';
import {
  OverlayItem,
  AppState,
  ContentType,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  YouTubeQuality,
  DEFAULT_YOUTUBE_QUALITY,
} from './types';
import { generateId, downloadJson, getYouTubeId, isImageUrl } from './utils/helpers';
import { Eye, X, Maximize, Minimize, Clipboard, Check } from 'lucide-react';

// Helper to check for existing saved state
const STORAGE_KEY = 'layout_forge_state';
const DEFAULT_REFRESH_INTERVAL_HOURS = 8;
const LAST_REFRESH_KEY = 'layout_forge_last_refresh';

const App: React.FC = () => {
  const [background, setBackground] = useState<{ type: ContentType, src: string }>({
    type: ContentType.IMAGE,
    src: ''
  });
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(DEFAULT_REFRESH_INTERVAL_HOURS);
  const [useSoftRefresh, setUseSoftRefresh] = useState(true);
  const [softRefreshKey, setSoftRefreshKey] = useState(0);
  // Global default YouTube quality. Applied to the background video and used
  // as the initial value for new YouTube overlays. Per-overlay `youtubeQuality`
  // (on OverlayItem) overrides this.
  const [defaultYoutubeQuality, setDefaultYoutubeQuality] = useState<YouTubeQuality>(DEFAULT_YOUTUBE_QUALITY);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue?: string;
    callback: (url: string) => void;
  } | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Config JSON Modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configJson, setConfigJson] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // --- Persistence & Initialization ---

  // Load from URL or local storage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const configParam = params.get('config');

    if (configParam) {
      try {
        const parsed: AppState = JSON.parse(decodeURIComponent(configParam));
        if (parsed) {
          setBackground({
            type: parsed.backgroundType || ContentType.IMAGE,
            src: parsed.backgroundSrc || ''
          });
          setOverlays(parsed.overlays || []);
          if (parsed.showUI !== undefined) setShowUI(parsed.showUI);
          if (parsed.refreshIntervalHours !== undefined) setRefreshIntervalHours(parsed.refreshIntervalHours);
          if (parsed.useSoftRefresh !== undefined) setUseSoftRefresh(parsed.useSoftRefresh);
          if (parsed.defaultYoutubeQuality !== undefined) setDefaultYoutubeQuality(parsed.defaultYoutubeQuality);
          if (parsed.isFullScreen) {
            setTimeout(() => {
              document.documentElement.requestFullscreen().catch(() => {});
            }, 1000);
          }
          return;
        }
      } catch (e) {
        console.error("Failed to parse config from URL", e);
      }
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppState = JSON.parse(saved);
        if (parsed) {
          setBackground({ type: parsed.backgroundType, src: parsed.backgroundSrc });
          setOverlays(parsed.overlays);
          if (parsed.showUI !== undefined) setShowUI(parsed.showUI);
          if (parsed.refreshIntervalHours !== undefined) setRefreshIntervalHours(parsed.refreshIntervalHours);
          if (parsed.useSoftRefresh !== undefined) setUseSoftRefresh(parsed.useSoftRefresh);
          if (parsed.defaultYoutubeQuality !== undefined) setDefaultYoutubeQuality(parsed.defaultYoutubeQuality);
          // We don't set isFullScreen state directly here as it's derived from document.fullscreenElement
          // But we can store the intent to restore it
          if (parsed.isFullScreen) {
            // Attempt to restore full screen after a short delay to ensure DOM is ready
            setTimeout(() => {
              document.documentElement.requestFullscreen().catch(() => {
                console.log("Auto-fullscreen blocked by browser. User interaction required.");
              });
            }, 1000);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load state from local storage", e);
    }
  }, []);

  // Save to local storage whenever state changes
  useEffect(() => {
    try {
      const state: AppState = {
        backgroundType: background.type,
        backgroundSrc: background.src,
        overlays,
        showUI,
        isFullScreen: !!document.fullscreenElement,
        refreshIntervalHours,
        useSoftRefresh,
        defaultYoutubeQuality,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore errors (e.g. quota exceeded or security blocks)
      console.warn("Failed to save state to local storage", e);
    }
  }, [background, overlays, showUI, isFullScreen, refreshIntervalHours, useSoftRefresh, defaultYoutubeQuality]);

  // Handle Full Screen Change Events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // --- Hard Refresh Logic (Every X Hours) ---
  useEffect(() => {
    const checkRefresh = () => {
      const lastRefresh = localStorage.getItem(LAST_REFRESH_KEY);
      const now = Date.now();
      const intervalMs = refreshIntervalHours * 60 * 60 * 1000;

      if (!lastRefresh) {
        localStorage.setItem(LAST_REFRESH_KEY, now.toString());
        return;
      }

      if (now - parseInt(lastRefresh) >= intervalMs) {
        // Update timestamp before reload to prevent infinite loop
        localStorage.setItem(LAST_REFRESH_KEY, now.toString());
        
        if (useSoftRefresh) {
          // Soft Refresh: Re-key the content area to force a full re-render of all iframes/images
          setSoftRefreshKey(prev => prev + 1);
          console.log("Soft refresh triggered at", new Date().toLocaleTimeString());
        } else {
          // Hard Refresh: Full page reload
          window.location.reload();
        }
      }
    };

    // Check immediately on mount
    checkRefresh();

    // Then check every minute
    const interval = setInterval(checkRefresh, 60000);
    return () => clearInterval(interval);
  }, [refreshIntervalHours]);

  // --- Mouse Idle Logic (Hide cursor after 5s) ---
  useEffect(() => {
    let timeoutId: number;

    const resetTimer = () => {
      setIsMouseIdle(false);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsMouseIdle(true);
      }, 5000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    // Initial timer
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('mousedown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.clearTimeout(timeoutId);
    };
  }, []);

  // --- Actions ---

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleAddOverlay = (type: ContentType, src: string) => {
    let finalType = type;
    let finalSrc = src;

    // Check if the source is actually a YouTube link
    const ytId = getYouTubeId(src);
    if (ytId) {
      finalType = ContentType.YOUTUBE;
      finalSrc = ytId;
    } else if (isImageUrl(src)) {
      // Auto-detect image
      finalType = ContentType.IMAGE;
    }

    // Determine reasonable default dimensions based on content type
    const width = finalType === ContentType.IMAGE ? DEFAULT_WIDTH : 600;
    const height = finalType === ContentType.IMAGE ? DEFAULT_HEIGHT : 450;

    // Calculate max z-index
    const maxZ = overlays.length > 0 ? Math.max(...overlays.map(o => o.zIndex)) : 0;

    const newOverlay: OverlayItem = {
      id: generateId(),
      type: finalType,
      src: finalSrc,
      x: 100 + (overlays.length * 20), // Cascade effect
      y: 100 + (overlays.length * 20),
      width,
      height,
      zIndex: maxZ + 1,
      opacity: 1,
      // YouTube overlays inherit the global default; user can override per-overlay.
      ...(finalType === ContentType.YOUTUBE ? { youtubeQuality: defaultYoutubeQuality } : {}),
    };
    setOverlays(prev => [...prev, newOverlay]);
    setSelectedId(newOverlay.id);
  };

  const handleSetBackground = (type: ContentType, src: string) => {
    // Check for YouTube URL
    const ytId = getYouTubeId(src);
    if (ytId) {
      setBackground({ type: ContentType.YOUTUBE, src: ytId });
    } else if (isImageUrl(src)) {
      setBackground({ type: ContentType.IMAGE, src });
    } else {
      setBackground({ type, src });
    }
  };

  const handleUpdateOverlay = useCallback((id: string, updates: Partial<OverlayItem>) => {
    setOverlays(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const handleDeleteOverlay = (id: string) => {
    setOverlays(prev => prev.filter(item => item.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleEditOverlay = (id: string, currentSrc: string) => {
    const item = overlays.find(o => o.id === id);
    const title = item?.type === ContentType.IMAGE ? "Edit Image Source" : "Edit URL";
    
    // For YouTube items, reconstruct a watch URL for editing if possible, or just pass the ID
    let displayValue = currentSrc;
    if (item?.type === ContentType.YOUTUBE) {
        displayValue = `https://www.youtube.com/watch?v=${currentSrc}`;
    }

    openUrlModal(title, (newUrl) => {
       // Check if new URL is YouTube
       const ytId = getYouTubeId(newUrl);
       if (ytId) {
         handleUpdateOverlay(id, { type: ContentType.YOUTUBE, src: ytId });
       } else if (isImageUrl(newUrl)) {
         handleUpdateOverlay(id, { type: ContentType.IMAGE, src: newUrl });
       } else {
         handleUpdateOverlay(id, { src: newUrl });
       }
    }, displayValue);
  };

  // Reorder Logic
  const handleLayerAction = (id: string, action: 'front' | 'back' | 'forward' | 'backward') => {
    setOverlays(prev => {
      // 1. Create a copy and sort by current zIndex to establish order
      const items = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return prev;

      const item = items[idx];
      items.splice(idx, 1); // Remove item from current position

      // 2. Insert at new position
      if (action === 'front') {
        items.push(item);
      } else if (action === 'back') {
        items.unshift(item);
      } else if (action === 'forward') {
        // Swap with next if possible
        const newIdx = Math.min(items.length, idx + 1);
        items.splice(newIdx, 0, item);
      } else if (action === 'backward') {
        // Swap with prev if possible
        const newIdx = Math.max(0, idx - 1);
        items.splice(newIdx, 0, item);
      }

      // 3. Re-assign zIndices sequentially to normalize
      return items.map((itm, index) => ({
        ...itm,
        zIndex: index + 1
      }));
    });
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the entire layout?")) {
      setOverlays([]);
      setBackground({ type: ContentType.IMAGE, src: '' });
      setSelectedId(null);
    }
  };

  // Push the current global default quality onto every existing YouTube overlay
  // that doesn't already have its own override. Useful when you've changed the
  // default and want to retroactively apply it to all matching overlays.
  const handleApplyDefaultQualityToOverlays = () => {
    setOverlays(prev =>
      prev.map(o =>
        o.type === ContentType.YOUTUBE && !o.youtubeQuality
          ? { ...o, youtubeQuality: defaultYoutubeQuality }
          : o,
      ),
    );
  };

  // --- Modal Logic ---

  const openUrlModal = (title: string, callback: (src: string) => void, defaultValue = '') => {
    setUrlInput(defaultValue);
    setModalConfig({ isOpen: true, title, defaultValue, callback });
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConfig || !urlInput.trim()) return;

    let url = urlInput.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) {
      url = 'https://' + url;
    }

    modalConfig.callback(url);
    setModalConfig(null);
  };

  // --- Import / Export ---

  const handleExport = () => {
    const state: AppState = {
      backgroundType: background.type,
      backgroundSrc: background.src,
      overlays,
      showUI,
      isFullScreen: !!document.fullscreenElement,
      refreshIntervalHours,
      useSoftRefresh,
      defaultYoutubeQuality,
    };
    downloadJson(state, `layout-forge-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed: AppState = JSON.parse(e.target?.result as string);
        if (parsed.overlays && Array.isArray(parsed.overlays)) {
          setBackground({
            type: parsed.backgroundType || ContentType.IMAGE,
            src: parsed.backgroundSrc || ''
          });
          setOverlays(parsed.overlays);
          if (parsed.showUI !== undefined) setShowUI(parsed.showUI);
          if (parsed.refreshIntervalHours !== undefined) setRefreshIntervalHours(parsed.refreshIntervalHours);
          if (parsed.useSoftRefresh !== undefined) setUseSoftRefresh(parsed.useSoftRefresh);
          if (parsed.defaultYoutubeQuality !== undefined) setDefaultYoutubeQuality(parsed.defaultYoutubeQuality);
          if (parsed.isFullScreen) {
            setTimeout(() => {
              document.documentElement.requestFullscreen().catch(() => {});
            }, 1000);
          }
        } else {
          alert("Invalid file format");
        }
      } catch (err) {
        alert("Failed to parse file");
      }
    };
    reader.readAsText(file);
  };

  // --- Bookmark Logic ---
  
  const handleBookmark = () => {
    const state: AppState = {
      backgroundType: background.type,
      backgroundSrc: background.src,
      overlays,
      showUI,
      isFullScreen: !!document.fullscreenElement,
      refreshIntervalHours,
      useSoftRefresh,
      defaultYoutubeQuality,
    };
    try {
      const json = JSON.stringify(state);
      // Warning for large payloads (e.g. data URIs)
      if (json.length > 5000) {
        if (!window.confirm("The configuration is very large (likely due to images) and might not be bookmarkable in all browsers. Do you want to try updating the URL anyway?")) {
          return;
        }
      }
      
      const url = new URL(window.location.href);
      url.searchParams.set('config', json);
      window.history.pushState({}, '', url.toString());
      alert("URL has been updated! You can now bookmark this page to save this specific configuration.");
    } catch(e) {
      alert("Failed to generate bookmark URL.");
    }
  };

  // --- Config Modal Logic ---

  const handleOpenConfig = () => {
    const state: AppState = {
      backgroundType: background.type,
      backgroundSrc: background.src,
      overlays,
      showUI,
      isFullScreen: !!document.fullscreenElement,
      refreshIntervalHours,
      useSoftRefresh,
      defaultYoutubeQuality,
    };
    setConfigJson(JSON.stringify(state, null, 2));
    setConfigModalOpen(true);
    setCopyFeedback(false);
  };

  const handleApplyConfig = () => {
    try {
      const parsed: AppState = JSON.parse(configJson);
      if (parsed) {
        setBackground({
          type: parsed.backgroundType || ContentType.IMAGE,
          src: parsed.backgroundSrc || ''
        });
        setOverlays(parsed.overlays || []);
        if (parsed.showUI !== undefined) setShowUI(parsed.showUI);
        if (parsed.refreshIntervalHours !== undefined) setRefreshIntervalHours(parsed.refreshIntervalHours);
        if (parsed.useSoftRefresh !== undefined) setUseSoftRefresh(parsed.useSoftRefresh);
        if (parsed.defaultYoutubeQuality !== undefined) setDefaultYoutubeQuality(parsed.defaultYoutubeQuality);
        if (parsed.isFullScreen) {
          setTimeout(() => {
            document.documentElement.requestFullscreen().catch(() => {});
          }, 1000);
        }
        setConfigModalOpen(false);
      }
    } catch (e) {
      alert("Invalid JSON configuration");
    }
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(configJson).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handleBackgroundClick = () => {
    setSelectedId(null);
  };

  return (
    <div className={`flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden relative ${isMouseIdle ? 'cursor-none' : ''}`}>
      
      {/* Floating Toggle Buttons (Visible when UI is hidden) */}
      {!showUI && (
        <div className="absolute top-4 right-4 z-[9998] flex gap-2">
           <button 
            onClick={toggleFullScreen}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2 rounded-full shadow-lg backdrop-blur-sm transition-all opacity-10 hover:opacity-100 duration-300"
            title="Toggle Full Screen"
          >
            {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button 
            onClick={() => setShowUI(true)}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2 rounded-full shadow-lg backdrop-blur-sm transition-all opacity-10 hover:opacity-100 duration-300"
            title="Show Interface"
          >
            <Eye size={20} />
          </button>
        </div>
      )}

      {showUI && (
        <Toolbar
          currentBackground={background}
          onAddOverlay={handleAddOverlay}
          onSetBackground={handleSetBackground}
          onSave={handleExport}
          onLoad={handleImport}
          onClear={handleClear}
          onOpenUrlModal={openUrlModal}
          onOpenConfigModal={handleOpenConfig}
          onHideUI={() => setShowUI(false)}
          onToggleFullScreen={toggleFullScreen}
          onBookmark={handleBookmark}
          isFullScreen={isFullScreen}
          refreshIntervalHours={refreshIntervalHours}
          onSetRefreshInterval={setRefreshIntervalHours}
          useSoftRefresh={useSoftRefresh}
          onToggleSoftRefresh={() => setUseSoftRefresh(!useSoftRefresh)}
          defaultYoutubeQuality={defaultYoutubeQuality}
          onSetDefaultYoutubeQuality={setDefaultYoutubeQuality}
          onApplyDefaultQualityToOverlays={handleApplyDefaultQualityToOverlays}
        />
      )}
      
      {/* Workspace Area */}
      <div 
        key={softRefreshKey}
        className="flex-1 relative overflow-auto bg-slate-900/50"
        onMouseDown={handleBackgroundClick} // Deselect when clicking empty space
      >
        {/* Background Layer */}
        <div className="absolute inset-0 min-w-full min-h-full flex items-center justify-center pointer-events-none z-0">
          {background.src ? (
            background.type === ContentType.IMAGE ? (
              <div 
                className="w-full h-full bg-no-repeat bg-center bg-cover opacity-100"
                style={{ backgroundImage: `url("${background.src}")` }}
              />
            ) : background.type === ContentType.YOUTUBE ? (
              <div className="absolute inset-0 w-full h-full overflow-hidden">
                 <YouTubePlayer
                   videoId={background.src}
                   quality={defaultYoutubeQuality}
                   className="w-full h-full pointer-events-none"
                   title="Background Video"
                 />
                 <div className="absolute inset-0 z-10 bg-transparent" />
              </div>
            ) : (
              <iframe 
                src={background.src} 
                className="w-full h-full border-none pointer-events-auto" 
                title="Background Page"
                referrerPolicy="no-referrer"
              />
            )
          ) : (
             <div className="text-slate-600 flex flex-col items-center">
               <div className="text-6xl font-black opacity-20 select-none">EMPTY</div>
               <p className="opacity-40 mt-4">Set a background or add overlays to start</p>
             </div>
          )}
        </div>

        {/* Overlay Layer - Renders on top of background */}
        <div className="absolute inset-0 w-full h-full overflow-hidden z-10 pointer-events-none">
          {overlays.map(item => (
            <OverlayElement
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              onSelect={setSelectedId}
              onUpdate={handleUpdateOverlay}
              onDelete={handleDeleteOverlay}
              onEdit={handleEditOverlay}
              onLayerAction={handleLayerAction}
              scale={1}
              defaultYoutubeQuality={defaultYoutubeQuality}
            />
          ))}
        </div>
      </div>
      
      {/* Footer Info */}
      {showUI && (
        <div className="h-6 bg-slate-950 text-slate-500 text-xs flex items-center px-4 justify-between border-t border-slate-800 z-50">
          <span>{overlays.length} item(s)</span>
          <span>
            {background.type === ContentType.YOUTUBE 
              ? 'YouTube Background Active' 
              : background.src 
                ? 'Background Active' 
                : 'No Background'}
          </span>
        </div>
      )}

      {/* URL Input Modal */}
      {modalConfig && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={handleModalSubmit}
            className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-100"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">{modalConfig.title}</h3>
              <button 
                type="button" 
                onClick={() => setModalConfig(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-2">URL / Source</label>
              <input 
                autoFocus
                type="text" 
                placeholder="https://example.com or http://example.com" 
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600 transition-all"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-2">Make sure the site allows iframe embedding.</p>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setModalConfig(null)} 
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-blue-900/20"
              >
                {modalConfig.defaultValue ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Configuration JSON Modal */}
      {configModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   Configuration JSON
                </h3>
                <button 
                  onClick={() => setConfigModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 min-h-0 mb-4">
                <textarea 
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  className="w-full h-full min-h-[300px] bg-slate-950 font-mono text-xs text-slate-300 p-4 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 resize-none"
                  spellCheck={false}
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                 <button 
                   onClick={handleCopyConfig}
                   className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${copyFeedback ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                 >
                   {copyFeedback ? <Check size={18} /> : <Clipboard size={18} />}
                   {copyFeedback ? 'Copied!' : 'Copy to Clipboard'}
                 </button>

                 <div className="flex gap-3">
                   <button 
                     onClick={() => setConfigModalOpen(false)}
                     className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors font-medium"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleApplyConfig}
                     className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-blue-900/20"
                   >
                     Apply Configuration
                   </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;