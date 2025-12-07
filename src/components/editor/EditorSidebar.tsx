"use client";

import { useEditor } from "./EditorContext";
import { Type, Image as ImageIcon, Square, Table as TableIcon, Layers, Settings, Grid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const EditorSidebar = () => {
    const { addBlock, selectedBlockId, template, updateBlock } = useEditor();
    const [activeTab, setActiveTab] = useState<'add' | 'layers' | 'settings'>('add');

    const selectedBlock = template.blocks.find(b => b.id === selectedBlockId);

    return (
        <div className="w-[300px] bg-[#0F0F0F] border-r border-white/5 flex flex-col h-full z-20">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-white/5">
                {[
                    { id: 'add', icon: Grid, label: 'Ajouter' },
                    { id: 'layers', icon: Layers, label: 'Calques' },
                    { id: 'settings', icon: Settings, label: 'Propriétés' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors relative",
                            activeTab === tab.id ? "text-cyan-400 bg-white/5" : "text-muted-foreground hover:text-white hover:bg-white/5"
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* TAB: ADD BLOCKS */}
                {activeTab === 'add' && (
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => addBlock('text')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/50 hover:bg-white/10 transition-all group">
                            <Type size={24} className="text-white group-hover:text-cyan-400 transition-colors" />
                            <span className="text-xs text-muted-foreground group-hover:text-white">Texte</span>
                        </button>
                        <button onClick={() => addBlock('image')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/50 hover:bg-white/10 transition-all group">
                            <ImageIcon size={24} className="text-white group-hover:text-cyan-400 transition-colors" />
                            <span className="text-xs text-muted-foreground group-hover:text-white">Image</span>
                        </button>
                        <button onClick={() => addBlock('table')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/50 hover:bg-white/10 transition-all group">
                            <TableIcon size={24} className="text-white group-hover:text-cyan-400 transition-colors" />
                            <span className="text-xs text-muted-foreground group-hover:text-white">Tableau</span>
                        </button>
                        <button onClick={() => addBlock('shape')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/50 hover:bg-white/10 transition-all group">
                            <Square size={24} className="text-white group-hover:text-cyan-400 transition-colors" />
                            <span className="text-xs text-muted-foreground group-hover:text-white">Forme</span>
                        </button>
                    </div>
                )}

                {/* TAB: PROPERTIES (Contextual) */}
                {activeTab === 'settings' && (
                    selectedBlock ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Apparence</h3>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-muted-foreground uppercase">Couleur Texte</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={selectedBlock.style.color || '#000000'}
                                            onChange={(e) => updateBlock(selectedBlock.id, { style: { ...selectedBlock.style, color: e.target.value } })}
                                            className="h-8 w-full bg-white/5 border border-white/10 rounded cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-muted-foreground uppercase">Taille Police (pt)</label>
                                    <input
                                        type="range"
                                        min="6" max="72"
                                        value={selectedBlock.style.fontSize || 12}
                                        onChange={(e) => updateBlock(selectedBlock.id, { style: { ...selectedBlock.style, fontSize: parseInt(e.target.value) } })}
                                        className="w-full accent-cyan-500"
                                    />
                                    <div className="text-right text-xs text-white">{selectedBlock.style.fontSize} pt</div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-muted-foreground uppercase">Police</label>
                                    <select
                                        value={selectedBlock.style.fontFamily || 'helvetica'}
                                        onChange={(e) => updateBlock(selectedBlock.id, { style: { ...selectedBlock.style, fontFamily: e.target.value } })}
                                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                                    >
                                        <option value="helvetica">Helvetica</option>
                                        <option value="times">Times New Roman</option>
                                        <option value="courier">Courier New</option>
                                        <option value="Arial">Arial</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-muted-foreground uppercase">Arrière-plan</label>
                                    <input
                                        type="color"
                                        value={selectedBlock.style.backgroundColor || '#ffffff'}
                                        onChange={(e) => updateBlock(selectedBlock.id, { style: { ...selectedBlock.style, backgroundColor: e.target.value } })}
                                        className="h-8 w-full bg-white/5 border border-white/10 rounded cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* IMAGE SPECIFIC PROPERTIES */}
                            {selectedBlock.type === 'image' && (
                                <div className="space-y-4 border-t border-white/10 pt-4">
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2">Image Source</h3>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-muted-foreground uppercase">URL ou Upload</label>
                                        <input
                                            type="text"
                                            value={selectedBlock.content}
                                            onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                            placeholder="https://..."
                                        />
                                        <label className="flex items-center justify-center w-full px-4 py-2 mt-2 bg-white/5 border border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                                            <span className="text-xs text-muted-foreground">Télécharger image</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            updateBlock(selectedBlock.id, { content: reader.result as string });
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* TABLE SPECIFIC PROPERTIES */}
                            {selectedBlock.type === 'table' && typeof selectedBlock.content === 'object' && selectedBlock.content?.columns && (
                                <div className="space-y-4 border-t border-white/10 pt-4">
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2">Colonnes Tableau</h3>
                                    <div className="space-y-2">
                                        {(selectedBlock.content.columns as any[]).map((col, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    value={col.header}
                                                    onChange={(e) => {
                                                        const newCols = [...selectedBlock.content.columns];
                                                        newCols[idx] = { ...newCols[idx], header: e.target.value };
                                                        updateBlock(selectedBlock.id, { content: { ...selectedBlock.content, columns: newCols } });
                                                    }}
                                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white flex-1"
                                                />
                                                <input
                                                    type="number"
                                                    value={col.width}
                                                    onChange={(e) => {
                                                        const newCols = [...selectedBlock.content.columns];
                                                        newCols[idx] = { ...newCols[idx], width: parseInt(e.target.value) };
                                                        updateBlock(selectedBlock.id, { content: { ...selectedBlock.content, columns: newCols } });
                                                    }}
                                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-12 text-center"
                                                />
                                                <span className="text-[10px] text-muted-foreground">%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Position & Dimensions</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">X (mm)</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBlock.x)}
                                            onChange={(e) => updateBlock(selectedBlock.id, { x: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">Y (mm)</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBlock.y)}
                                            onChange={(e) => updateBlock(selectedBlock.id, { y: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">L (mm)</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBlock.width)}
                                            onChange={(e) => updateBlock(selectedBlock.id, { width: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">H (mm)</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBlock.height)}
                                            onChange={(e) => updateBlock(selectedBlock.id, { height: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div >
                    ) : (
                        <div className="text-center py-10 text-muted-foreground text-xs">
                            Sélectionnez un bloc pour voir ses propriétés.
                        </div>
                    )
                )}

                {/* TAB: LAYERS */}
                {
                    activeTab === 'layers' && (
                        <div className="space-y-2">
                            {template.blocks.slice().reverse().map((block, i) => (
                                <div
                                    key={block.id}
                                    onClick={() => useEditor().selectBlock(block.id)}
                                    className={cn(
                                        "p-2 rounded flex items-center gap-2 cursor-pointer transition-colors border",
                                        selectedBlockId === block.id
                                            ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                                            : "bg-white/5 border-transparent hover:bg-white/10 text-white"
                                    )}
                                >
                                    {block.type === 'text' && <Type size={14} />}
                                    {block.type === 'image' && <ImageIcon size={14} />}
                                    {block.type === 'table' && <TableIcon size={14} />}
                                    {block.type === 'shape' && <Square size={14} />}
                                    <span className="text-xs truncate flex-1">
                                        {block.content && typeof block.content === 'string'
                                            ? (block.content.length > 20 ? block.content.substring(0, 20) + '...' : block.content)
                                            : block.type
                                        }
                                    </span>
                                </div>
                            ))}
                            {template.blocks.length === 0 && (
                                <div className="text-center py-4 text-xs text-muted-foreground">Aucun calque</div>
                            )}
                        </div>
                    )
                }
            </div >
        </div >
    );
};
