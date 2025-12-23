import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SafePortal } from './SafePortal';

interface SidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export function SidePanel({ isOpen, onClose, title, children, className }: SidePanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <SafePortal>
            <div className="fixed inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={onClose}
                />

                {/* Panel */}
                <div
                    ref={panelRef}
                    className={cn(
                        "relative w-full max-w-2xl h-full bg-background dark:bg-[#1e1e1e] border-l border-border dark:border-white/10 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col",
                        className
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {children}
                    </div>
                </div>
            </div>
        </SafePortal>
    );
}
