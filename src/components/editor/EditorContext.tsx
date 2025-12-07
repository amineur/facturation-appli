"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ProTemplate, TemplateBlock, PageSettings, BlockType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface EditorState {
    template: ProTemplate;
    selectedBlockId: string | null;
    scale: number;
    history: ProTemplate[];
    historyIndex: number;
}

interface EditorContextType extends EditorState {
    // Actions
    addBlock: (type: BlockType, x?: number, y?: number) => void;
    updateBlock: (id: string, updates: Partial<TemplateBlock>) => void;
    deleteBlock: (id: string) => void;
    selectBlock: (id: string | null) => void;
    updatePageSettings: (settings: Partial<PageSettings>) => void;
    setScale: (scale: number) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    loadTemplate: (template: ProTemplate) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

const DEFAULT_TEMPLATE: ProTemplate = {
    id: 'new',
    name: 'Nouveau Modèle',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    pageSettings: {
        format: 'a4',
        orientation: 'portrait',
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        gridSize: 10,
        showGrid: true,
        snapToGrid: true
    },
    blocks: []
};

export function EditorProvider({ children }: { children: ReactNode }) {
    const [template, setTemplate] = useState<ProTemplate>(DEFAULT_TEMPLATE);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [history, setHistory] = useState<ProTemplate[]>([DEFAULT_TEMPLATE]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const pushToHistory = useCallback((newTemplate: ProTemplate) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newTemplate);
        if (newHistory.length > 20) newHistory.shift(); // Limit history size
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setTemplate(newTemplate);
    }, [history, historyIndex]);

    const addBlock = useCallback((type: BlockType, x = 10, y = 10) => {
        const newBlock: TemplateBlock = {
            id: uuidv4(),
            type,
            x,
            y,
            width: type === 'line' ? 50 : 40,
            height: type === 'line' ? 2 : 20,
            content: type === 'text' ? 'Nouveau texte' : (type === 'table' ? {
                columns: [
                    { id: 'col1', header: 'Description', width: 40 },
                    { id: 'col2', header: 'Qté', width: 15 },
                    { id: 'col3', header: 'Prix Unit.', width: 20 },
                    { id: 'col4', header: 'Total', width: 25 }
                ],
                showHeaders: true
            } : ''),
            style: {
                fontSize: 12,
                color: '#000000',
                fontFamily: 'helvetica',
                zIndex: 1
            }
        };

        const newTemplate = {
            ...template,
            blocks: [...template.blocks, newBlock]
        };
        pushToHistory(newTemplate);
        setSelectedBlockId(newBlock.id);
    }, [template, pushToHistory]);

    const updateBlock = useCallback((id: string, updates: Partial<TemplateBlock>) => {
        const newTemplate = {
            ...template,
            blocks: template.blocks.map(b => b.id === id ? { ...b, ...updates } : b)
        };
        // Debounce history push could be added here for drag operations
        setTemplate(newTemplate);
        // Only push to history on drag end (logic usually handled in component)
        // For now, we update state directly.
    }, [template]);

    // Distinct function to commit changes to history (e.g. onDragEnd)
    const commitChanges = useCallback(() => {
        pushToHistory(template);
    }, [template, pushToHistory]);

    const deleteBlock = useCallback((id: string) => {
        const newTemplate = {
            ...template,
            blocks: template.blocks.filter(b => b.id !== id)
        };
        pushToHistory(newTemplate);
        setSelectedBlockId(null);
    }, [template, pushToHistory]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setTemplate(history[newIndex]);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setTemplate(history[newIndex]);
        }
    }, [history, historyIndex]);

    const updatePageSettings = useCallback((settings: Partial<PageSettings>) => {
        const newTemplate = {
            ...template,
            pageSettings: { ...template.pageSettings, ...settings }
        };
        pushToHistory(newTemplate);
    }, [template, pushToHistory]);

    return (
        <EditorContext.Provider value={{
            template,
            selectedBlockId,
            scale,
            history,
            historyIndex,
            addBlock,
            updateBlock,
            deleteBlock,
            selectBlock: setSelectedBlockId,
            updatePageSettings,
            setScale,
            undo,
            redo,
            canUndo: historyIndex > 0,
            canRedo: historyIndex < history.length - 1,
            loadTemplate: (t) => { setTemplate(t); setHistory([t]); setHistoryIndex(0); }
        }}>
            {children}
        </EditorContext.Provider>
    );
}

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context) throw new Error('useEditor must be used within an EditorProvider');
    return context;
};
