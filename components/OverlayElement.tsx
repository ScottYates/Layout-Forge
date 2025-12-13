import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OverlayItem, ContentType } from '../types';
import { Trash2, Pencil, ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown, Timer } from 'lucide-react';
import { getYouTubeEmbedUrl } from '../utils/helpers';

interface OverlayElementProps {
  item: OverlayItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<OverlayItem>) => void;
  onEdit: (id: string, currentSrc: string) => void;
  onDelete: (id: string) => void;
  onLayerAction: (id: string, action: 'front' | 'back' | 'forward' | 'backward') => void;
  scale: number;
}

export const OverlayElement: React.FC<OverlayElementProps> = ({
  item,
  isSelected,
  onSelect,
  onUpdate,
  onEdit,
  onDelete,
  onLayerAction,
  scale = 1
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const elementRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startDims = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Handle Refresh Timer
  useEffect(() => {
    if (item.refreshInterval && item.refreshInterval > 0) {
      const intervalId = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, item.refreshInterval * 1000);
      return () => clearInterval(intervalId);
    }
  }, [item.refreshInterval]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id);
    
    if (e.button !== 0) return;

    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startDims.current = { x: item.x, y: item.y, w: item.width, h: item.height };
    
    document.body.classList.add('dragging-active');
  };

  const handleResizeStart = (e: React.MouseEvent, dir: string) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    
    setIsResizing(true);
    setResizeDir(dir);
    startPos.current = { x: e.clientX, y: e.clientY };
    startDims.current = { x: item.x, y: item.y, w: item.width, h: item.height };
    
    document.body.classList.add('dragging-active');
  };

  const onWindowMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging && !isResizing) return;

    const dx = (e.clientX - startPos.current.x) / scale;
    const dy = (e.clientY - startPos.current.y) / scale;

    if (isDragging) {
      onUpdate(item.id, {
        x: startDims.current.x + dx,
        y: startDims.current.y + dy
      });
    } else if (isResizing && resizeDir) {
      let newX = startDims.current.x;
      let newY = startDims.current.y;
      let newW = startDims.current.w;
      let newH = startDims.current.h;

      if (resizeDir.includes('e')) newW = Math.max(50, startDims.current.w + dx);
      if (resizeDir.includes('s')) newH = Math.max(50, startDims.current.h + dy);
      if (resizeDir.includes('w')) {
        const proposedW = startDims.current.w - dx;
        if (proposedW > 50) {
          newX = startDims.current.x + dx;
          newW = proposedW;
        }
      }
      if (resizeDir.includes('n')) {
        const proposedH = startDims.current.h - dy;
        if (proposedH > 50) {
          newY = startDims.current.y + dy;
          newH = proposedH;
        }
      }

      onUpdate(item.id, { x: newX, y: newY, width: newW, height: newH });
    }
  }, [isDragging, isResizing, resizeDir, item.id, onUpdate, scale]);

  const onWindowMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDir(null);
      document.body.classList.remove('dragging-active');
    }
  }, [isDragging, isResizing]);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', onWindowMouseMove);
      window.addEventListener('mouseup', onWindowMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [isDragging, isResizing, onWindowMouseMove, onWindowMouseUp]);
  
  const borderClass = isSelected ? 'border-2 border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.5)]' : 'border border-transparent hover:border-slate-500/50';

  return (
    <div
      ref={elementRef}
      className={`absolute select-none group ${borderClass} transition-shadow duration-150`}
      style={{
        transform: `translate(${item.x}px, ${item.y}px)`,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Content */}
      <div className="w-full h-full overflow-hidden bg-slate-800/50 relative">
        {item.type === ContentType.IMAGE ? (
          <img 
            key={`${item.id}-${refreshKey}`}
            src={item.src} 
            alt="overlay" 
            className="w-full h-full object-cover pointer-events-none" 
            style={{ opacity: item.opacity }}
          />
        ) : item.type === ContentType.YOUTUBE ? (
          <>
            <div className="absolute inset-0 z-10 bg-transparent" />
            <iframe 
              key={`${item.id}-${refreshKey}`}
              src={getYouTubeEmbedUrl(item.src)}
              className="w-full h-full pointer-events-none" 
              title={`frame-${item.id}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ opacity: item.opacity }}
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0 z-10 bg-transparent" />
            <iframe 
              key={`${item.id}-${refreshKey}`}
              src={item.src} 
              className="w-full h-full pointer-events-none" 
              title={`frame-${item.id}`}
              style={{ opacity: item.opacity }}
            />
          </>
        )}
      </div>

      {/* Controls Overlay (Visible on Select) */}
      {(isSelected) && (
        <>
          {/* Resize Handles */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 cursor-nw-resize rounded-full border border-white z-50" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 cursor-ne-resize rounded-full border border-white z-50" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 cursor-sw-resize rounded-full border border-white z-50" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 cursor-se-resize rounded-full border border-white z-50" onMouseDown={(e) => handleResizeStart(e, 'se')} />
          
          {/* Top Right Controls: Delete & Edit */}
          <div className="absolute -top-10 right-0 flex items-center gap-1 z-50">
             <button
              className="bg-slate-700 text-slate-200 p-1.5 rounded-md shadow-sm hover:bg-slate-600 transition-colors"
              onMouseDown={(e) => { e.stopPropagation(); onEdit(item.id, item.src); }}
              title="Edit Source"
            >
              <Pencil size={16} />
            </button>
            <button
              className="bg-red-500 text-white p-1.5 rounded-md shadow-sm hover:bg-red-600 transition-colors"
              onMouseDown={(e) => { e.stopPropagation(); onDelete(item.id); }}
              title="Remove Overlay"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Top Left Controls: Layer Ordering */}
          <div className="absolute -top-10 left-0 flex items-center gap-1 z-50 bg-slate-800 p-1 rounded-md border border-slate-700 shadow-sm">
            <button
              className="text-slate-300 hover:text-white hover:bg-slate-700 p-1 rounded"
              onMouseDown={(e) => { e.stopPropagation(); onLayerAction(item.id, 'front'); }}
              title="Bring to Front"
            >
              <ArrowUpToLine size={14} />
            </button>
            <button
              className="text-slate-300 hover:text-white hover:bg-slate-700 p-1 rounded"
              onMouseDown={(e) => { e.stopPropagation(); onLayerAction(item.id, 'forward'); }}
              title="Bring Forward"
            >
              <ArrowUp size={14} />
            </button>
             <button
              className="text-slate-300 hover:text-white hover:bg-slate-700 p-1 rounded"
              onMouseDown={(e) => { e.stopPropagation(); onLayerAction(item.id, 'backward'); }}
              title="Send Backward"
            >
              <ArrowDown size={14} />
            </button>
            <button
              className="text-slate-300 hover:text-white hover:bg-slate-700 p-1 rounded"
              onMouseDown={(e) => { e.stopPropagation(); onLayerAction(item.id, 'back'); }}
              title="Send to Back"
            >
              <ArrowDownToLine size={14} />
            </button>
          </div>
          
          {/* Opacity & Refresh Control */}
          <div className="absolute -top-10 right-20 bg-slate-800 p-1 rounded-md shadow-sm flex items-center gap-2 border border-slate-700 z-50" onMouseDown={e => e.stopPropagation()}>
             {/* Refresh Timer Input */}
             <div className="flex items-center gap-1 pl-1 border-r border-slate-600 pr-2 mr-1" title="Auto-refresh interval in seconds (0 to disable)">
               <Timer size={14} className={item.refreshInterval ? "text-blue-400" : "text-slate-500"} />
               <input 
                 type="number" 
                 min="0"
                 placeholder="Off"
                 value={item.refreshInterval || ''}
                 onChange={(e) => {
                   const val = parseInt(e.target.value);
                   onUpdate(item.id, { refreshInterval: isNaN(val) ? 0 : val });
                 }}
                 className="w-10 bg-transparent text-xs text-white focus:outline-none text-center appearance-none"
               />
               <span className="text-[10px] text-slate-500">s</span>
             </div>

             <span className="text-xs text-slate-400 px-1">Opacity</span>
             <input 
               type="range" 
               min="0.1" 
               max="1" 
               step="0.1" 
               value={item.opacity} 
               onChange={(e) => onUpdate(item.id, { opacity: parseFloat(e.target.value) })}
               className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
             />
          </div>
        </>
      )}
    </div>
  );
};