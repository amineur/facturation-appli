"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}

export function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-[70] bg-background border-t border-border rounded-t-[20px] shadow-2xl max-h-[85vh] flex flex-col"
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.05}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 100) onClose();
                        }}
                    >
                        {/* Drag Handle */}
                        <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
                        </div>

                        {/* Content */}
                        <div className="p-4 pt-1">
                            {(title || onClose) && (
                                <div className="flex items-center justify-between mb-4">
                                    {title && <h2 className="text-lg font-bold">{title}</h2>}
                                    <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:bg-muted rounded-full">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            )}
                            <div className="overflow-y-auto pb-safe">
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
