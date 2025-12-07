"use client";

import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type } from "lucide-react";
import { useEditor } from "./EditorContext";

interface FloatingToolbarProps {
    blockId: string;
    style: React.CSSProperties;
    onStyleChange: (styleUpdate: any) => void;
    currentStyle: any;
}

export const FloatingToolbar = ({ blockId, style, onStyleChange, currentStyle }: FloatingToolbarProps) => {
    return (
        <div
            className="absolute z-50 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl flex items-center p-1 gap-1 -translate-x-1/2 left-1/2 -top-12"
            onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
        >
            <button
                onClick={() => onStyleChange({ fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold' })}
                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${currentStyle.fontWeight === 'bold' ? 'text-cyan-400 bg-white/5' : 'text-white'}`}
            >
                <Bold size={14} />
            </button>
            <button
                onClick={() => onStyleChange({ fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic' })}
                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${currentStyle.fontStyle === 'italic' ? 'text-cyan-400 bg-white/5' : 'text-white'}`}
            >
                <Italic size={14} />
            </button>
            <button
                onClick={() => onStyleChange({ underline: !currentStyle.underline })}
                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${currentStyle.underline ? 'text-cyan-400 bg-white/5' : 'text-white'}`}
            >
                <Underline size={14} />
            </button>

            <div className="w-px h-4 bg-white/10 mx-1" />

            <button
                onClick={() => onStyleChange({ textAlign: 'left' })}
                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${currentStyle.textAlign === 'left' ? 'text-cyan-400 bg-white/5' : 'text-white'}`}
            >
                <AlignLeft size={14} />
            </button>
            <button
                onClick={() => onStyleChange({ textAlign: 'center' })}
                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${currentStyle.textAlign === 'center' ? 'text-cyan-400 bg-white/5' : 'text-white'}`}
            >
                <AlignCenter size={14} />
            </button>
            <button
                onClick={() => onStyleChange({ textAlign: 'right' })}
                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${currentStyle.textAlign === 'right' ? 'text-cyan-400 bg-white/5' : 'text-white'}`}
            >
                <AlignRight size={14} />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <input
                type="number"
                value={currentStyle.fontSize || 12}
                onChange={(e) => onStyleChange({ fontSize: parseInt(e.target.value) })}
                className="w-12 bg-transparent text-xs text-white border-none focus:ring-0 text-center"
            />
            <span className="text-[10px] text-muted-foreground pr-2">pt</span>
        </div>
    );
};
