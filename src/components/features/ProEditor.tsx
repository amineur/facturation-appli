"use client";

import { EditorProvider } from "@/components/editor/EditorContext";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { ArrowLeft } from "lucide-react";

interface ProEditorProps {
    onBack?: () => void;
}

export function ProEditor({ onBack }: ProEditorProps) {
    return (
        <EditorProvider>
            <div className="flex flex-col h-full bg-[#0A0A0A] overflow-hidden rounded-xl border border-white/10">
                <div className="flex items-center gap-2 p-2 border-b border-white/10 bg-[#0A0A0A]">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    )}
                    <EditorToolbar />
                </div>
                <div className="flex-1 flex overflow-hidden">
                    <EditorSidebar />
                    <div className="flex-1 relative flex flex-col min-w-0">
                        <EditorCanvas />
                    </div>
                </div>
            </div>
        </EditorProvider>
    );
}
