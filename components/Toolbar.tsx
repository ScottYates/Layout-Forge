import React, { useRef } from 'react';
import { Download, Upload, Plus, Image as ImageIcon, Globe, Monitor, Settings, Trash, EyeOff, Maximize, Minimize, Link, FileJson, Bookmark } from 'lucide-react';
import { fileToDataUri } from '../utils/helpers';
import { ContentType, OverlayItem } from '../types';

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
  onToggleSoftRefresh
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
      </div>
    </div>
  );
};