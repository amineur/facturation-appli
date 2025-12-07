"use client";

import { EditorProvider } from "@/components/editor/EditorContext";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { EditorCanvas } from "@/components/editor/EditorCanvas";

export default function ProEditorPage() {
    return (
        <EditorProvider>
            <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#0A0A0A] overflow-hidden">
                <EditorToolbar />
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
