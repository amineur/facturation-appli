"use client";

import { useEditor } from "./EditorContext";
import { Undo, Redo, ZoomIn, ZoomOut, Save, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateProTemplatePDF } from "@/lib/pro-pdf-generator";

export const EditorToolbar = () => {
    const {
        undo, redo, canUndo, canRedo,
        scale, setScale,
        template
    } = useEditor();

    return (
        <div className="h-14 border-b border-white/5 bg-[#0F0F0F] flex items-center justify-between px-4 sticky top-0 z-20">
            {/* Left: History Controls */}
            <div className="flex items-center gap-2">
                <button
                    onClick={undo} disabled={!canUndo}
                    className="p-2 rounded hover:bg-white/10 text-white disabled:opacity-30 transition-colors"
                >
                    <Undo size={18} />
                </button>
                <button
                    onClick={redo} disabled={!canRedo}
                    className="p-2 rounded hover:bg-white/10 text-white disabled:opacity-30 transition-colors"
                >
                    <Redo size={18} />
                </button>
                <div className="w-px h-6 bg-white/10 mx-2" />
                <span className="text-sm font-medium text-white/80">{template.name}</span>
            </div>

            {/* Center: Zoom Controls */}
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
                <button
                    onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                    className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
                >
                    <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono text-cyan-400 w-12 text-center">
                    {Math.round(scale * 100)}%
                </span>
                <button
                    onClick={() => setScale(Math.min(2, scale + 0.1))}
                    className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
                >
                    <ZoomIn size={16} />
                </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-colors border border-white/5">
                    <Save size={14} />
                    Sauvegarder
                </button>
                <button
                    onClick={() => {
                        const doc = generateProTemplatePDF(template);
                        doc.save(`${template.name}.pdf`);
                    }}
                    className="flex items-center gap-2 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-lg shadow-emerald-600/20"
                >
                    <Download size={14} />
                    Exporter PDF
                </button>
            </div>
        </div>
    );
};
