"use client";

import { TemplateBlock } from "@/types";
import { useEditor } from "./EditorContext";
import { motion, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { GripVertical, X, Copy, Lock, Unlock } from "lucide-react";
import { FloatingToolbar } from "./FloatingToolbar";

interface DraggableBlockProps {
    block: TemplateBlock;
    scale: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export const DraggableBlock = ({ block, scale, containerRef }: DraggableBlockProps) => {
    const { updateBlock, selectBlock, selectedBlockId, deleteBlock } = useEditor();
    const isSelected = selectedBlockId === block.id;
    const controls = useDragControls();

    // Inline Editing State
    const [isEditing, setIsEditing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Convert mm to pixels for display (1mm approx 3.78px)
    const MM_TO_PX = 3.78;

    useEffect(() => {
        if (!isSelected) {
            setIsEditing(false);
        }
    }, [isSelected]);

    useEffect(() => {
        if (isEditing && contentRef.current) {
            contentRef.current.focus();
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(contentRef.current);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }, [isEditing]);

    const handleContentChange = () => {
        if (contentRef.current) {
            updateBlock(block.id, { content: contentRef.current.innerHTML });
        }
    };

    return (
        <motion.div
            drag={!block.isLocked && !isEditing}
            dragListener={!block.isLocked && !isEditing}
            dragMomentum={false}
            dragElastic={0}
            dragControls={controls}
            whileDrag={{ scale: 1.02, zIndex: 100, cursor: 'grabbing' }}
            onDragEnd={(_, info) => {
                const dx = info.offset.x / scale / MM_TO_PX;
                const dy = info.offset.y / scale / MM_TO_PX;
                updateBlock(block.id, { x: block.x + dx, y: block.y + dy });
            }}
            initial={{ x: block.x * MM_TO_PX, y: block.y * MM_TO_PX }}
            animate={{
                x: block.x * MM_TO_PX,
                y: block.y * MM_TO_PX,
                width: block.width * MM_TO_PX,
                height: block.height * MM_TO_PX,
                zIndex: isSelected ? 50 : block.style.zIndex || 1
            }}
            style={{
                position: 'absolute',
                border: isSelected && !isEditing ? '2px solid #06b6d4' : (isEditing ? '1px dashed #06b6d4' : '1px solid transparent'),
                backgroundColor: block.style.backgroundColor || 'transparent',
                color: block.style.color,
                fontFamily: block.style.fontFamily,
                fontSize: `${block.style.fontSize}pt`,
                fontWeight: block.style.fontWeight,
                fontStyle: block.style.fontStyle,
                textAlign: block.style.textAlign,
                textDecoration: block.style.underline ? 'underline' : 'none',
                cursor: block.isLocked ? 'default' : (isEditing ? 'text' : 'grab'),
            }}
            className={cn(
                "group transition-colors",
                isSelected && !isEditing && "shadow-xl ring-2 ring-cyan-500/20"
            )}
            onClick={(e) => {
                e.stopPropagation();
                selectBlock(block.id);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (block.type === 'text' && !block.isLocked) setIsEditing(true);
            }}
        >
            {/* INLINE EDITING TOOLBAR */}
            {isEditing && (
                <FloatingToolbar
                    blockId={block.id}
                    style={{ top: -50 }}
                    currentStyle={block.style}
                    onStyleChange={(updates) => updateBlock(block.id, { style: { ...block.style, ...updates } })}
                />
            )}

            {/* Content Rendering */}
            <div className="w-full h-full overflow-hidden p-1">
                {block.type === 'text' && (
                    <div
                        ref={contentRef}
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        onBlur={() => {
                            setIsEditing(false);
                            handleContentChange();
                        }}
                        onKeyDown={(e) => e.stopPropagation()} // Allow typing
                        dangerouslySetInnerHTML={{ __html: block.content }}
                        className="w-full h-full outline-none focus:outline-none cursor-text"
                        style={{ pointerEvents: isEditing ? 'auto' : 'none' }}
                    />
                )}
                {block.type === 'image' && (
                    <img
                        src={block.content}
                        alt="Block content"
                        className="w-full h-full object-contain pointer-events-none"
                    />
                )}
                {block.type === 'shape' && (
                    <div className="w-full h-full bg-current opacity-20" />
                )}
                {block.type === 'line' && (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-full h-px bg-current" style={{ height: block.height * 3.78 }} />
                    </div>
                )}
                {block.type === 'table' && (
                    <div className="w-full h-full border border-current opacity-70 flex flex-col bg-white/5" style={{ borderColor: block.style.borderColor || 'currentColor' }}>
                        {/* Header Row */}
                        <div className="flex border-b border-current/20 min-h-[20px]" style={{ backgroundColor: block.style.borderColor ? block.style.borderColor + '20' : 'rgba(255,255,255,0.1)' }}>
                            {block.content?.columns ? (
                                (block.content.columns as any[]).map((col: any) => (
                                    <div key={col.id} className="flex items-center px-1 text-[6px] md:text-[8px] font-bold border-r border-current/10 overflow-hidden whitespace-nowrap" style={{ width: `${col.width}%` }}>
                                        {col.header}
                                    </div>
                                ))
                            ) : (
                                <div className="p-1 text-[8px] w-full text-center">Tableau non configuré</div>
                            )}
                        </div>
                        {/* Body Rows Placeholder */}
                        <div className="flex-1 flex flex-col">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex border-b border-current/5 last:border-0 h-4 md:h-5">
                                    {block.content?.columns && (block.content.columns as any[]).map((col: any) => (
                                        <div key={col.id} style={{ width: `${col.width}%` }} className="border-r border-current/5 last:border-0" />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Selection UI (Handles & Actions) */}
            {isSelected && !isEditing && (
                <>
                    {/* Resize Handles (Simplified) */}
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full cursor-se-resize" />

                    {/* Action Bar */}
                    <div className="absolute -top-10 left-0 bg-[#1A1A1A] border border-white/10 rounded-md flex items-center shadow-lg transform scale-invariant z-50">
                        <button onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }} className="p-1.5 hover:bg-red-500/20 hover:text-red-500 text-white/70 transition-colors">
                            <X size={14} />
                        </button>
                        <div className="w-px h-3 bg-white/10 mx-1" />
                        <button onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { isLocked: !block.isLocked }) }} className="p-1.5 hover:bg-white/10 text-white/70 transition-colors">
                            {block.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); useEditor().addBlock(block.type, block.x + 5, block.y + 5); }} className="p-1.5 hover:bg-white/10 text-white/70 transition-colors">
                            <Copy size={14} />
                        </button>
                    </div>
                </>
            )}
        </motion.div>
    );
};
