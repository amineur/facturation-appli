"use client";

import { useEditor } from "./EditorContext";
import { DraggableBlock } from "./DraggableBlock";
import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export const EditorCanvas = () => {
    const { template, scale, selectBlock, addBlock } = useEditor();
    const containerRef = useRef<HTMLDivElement>(null);

    // A4 dimensions in mm
    const A4_WIDTH = 210;
    const A4_HEIGHT = 297;

    // Convert to pixels (approx 96 DPI / 25.4 * scale)
    // Using a fixed multiplier for screen display, consistent with DraggableBlock
    const MM_TO_PX = 3.78;

    // Grid rendering
    const gridSize = template.pageSettings.gridSize * MM_TO_PX;

    return (
        <div
            className="relative flex justify-center py-20 bg-[#1A1A1A] overflow-auto min-h-full"
            onClick={() => selectBlock(null)} // Deselect on click outside
        >
            <div
                ref={containerRef}
                className="relative bg-white shadow-2xl transition-transform duration-200 ease-out"
                style={{
                    width: `${A4_WIDTH * MM_TO_PX}px`,
                    height: `${A4_HEIGHT * MM_TO_PX}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center'
                }}
            >
                {/* Grid Overlay */}
                {template.pageSettings.showGrid && (
                    <div
                        className="absolute inset-0 pointer-events-none z-0 opacity-10"
                        style={{
                            backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
                            backgroundSize: `${gridSize}px ${gridSize}px`
                        }}
                    />
                )}

                {/* Margins Indicators (Visual Guide) */}
                <div
                    className="absolute border border-dashed border-red-500/20 pointer-events-none z-0"
                    style={{
                        top: template.pageSettings.margins.top * MM_TO_PX,
                        bottom: template.pageSettings.margins.bottom * MM_TO_PX,
                        left: template.pageSettings.margins.left * MM_TO_PX,
                        right: template.pageSettings.margins.right * MM_TO_PX,
                        position: 'absolute'
                    }}
                />

                {/* Blocks Layer */}
                {template.blocks.map((block) => (
                    <DraggableBlock
                        key={block.id}
                        block={block}
                        scale={scale}
                        containerRef={containerRef}
                    />
                ))}
            </div>
        </div>
    );
};
