import React, { useState, useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { OverlayElement } from './components/OverlayElement';
import { OverlayItem, AppState, ContentType, DEFAULT_WIDTH, DEFAULT_HEIGHT } from './types';
import { generateId, downloadJson, getYouTubeId, getYouTubeEmbedUrl, isImageUrl } from './utils/helpers';
import { Eye, X, Maximize, Minimize } from 'lucide-react';

// Helper to check for existing saved state
const STORAGE_KEY = 'layout_forge_state';

const App: React.FC = () => {
  const [background, setBackground] = useState<{ type: ContentType, src: string }>({
    type: ContentType.IMAGE,
    src: ''
  });
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue?: string;
    callback: (url: string) => void;
  } | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // --- Persistence ---

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: AppState = JSON.parse(saved);
        setBackground({ type: parsed.backgroundType, src: parsed.backgroundSrc });
        setOverlays(parsed.overlays);
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
  }, []);

  // Save to local storage whenever state changes
  useEffect(() => {
    const state: AppState = {
      backgroundType: background.type,
      backgroundSrc: background.src,
      overlays
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [background, overlays]);

  // Handle Full Screen Change Events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
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
    }, currentSrc);
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
      overlays
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
        } else {
          alert("Invalid file format");
        }
      } catch (err) {
        alert("Failed to parse file");
      }
    };
    reader.readAsText(file);
  };

  const handleBackgroundClick = () => {
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden relative">
      
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
          onAddOverlay={handleAddOverlay}
          onSetBackground={handleSetBackground}
          onSave={handleExport}
          onLoad={handleImport}
          onClear={handleClear}
          onOpenUrlModal={openUrlModal}
          onHideUI={() => setShowUI(false)}
          onToggleFullScreen={toggleFullScreen}
          isFullScreen={isFullScreen}
        />
      )}
      
      {/* Workspace Area */}
      <div 
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
                 <iframe
                   src={getYouTubeEmbedUrl(background.src)}
                   className="w-full h-full pointer-events-none"
                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                   referrerPolicy="strict-origin-when-cross-origin"
                   title="Background Video"
                 />
                 <div className="absolute inset-0 z-10 bg-transparent" />
              </div>
            ) : (
              <iframe 
                src={background.src} 
                className="w-full h-full border-none pointer-events-auto" 
                title="Background Page"
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
            <div key={item.id} className="pointer-events-auto">
              <OverlayElement
                item={item}
                isSelected={selectedId === item.id}
                onSelect={setSelectedId}
                onUpdate={handleUpdateOverlay}
                onDelete={handleDeleteOverlay}
                onEdit={handleEditOverlay}
                onLayerAction={handleLayerAction}
                scale={1}
              />
            </div>
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
                placeholder="https://example.com" 
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
    </div>
  );
};

export default App;