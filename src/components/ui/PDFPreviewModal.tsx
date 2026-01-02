"use client";

import { X, Printer, Download } from "lucide-react";
import { useEffect, useRef } from "react";

interface PDFPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string | null;
    invoiceNumber: string;
}

export function PDFPreviewModal({ isOpen, onClose, pdfUrl, invoiceNumber }: PDFPreviewModalProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    const handlePrint = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.print();
        }
    };

    if (!isOpen || !pdfUrl) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-[95vw] h-[95vh] flex flex-col glass-card bg-background dark:bg-[#0A0A0A]/90 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-border dark:border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border dark:border-white/10 bg-muted/50 dark:bg-white/5">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <span>Aperçu</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-emerald-500">{invoiceNumber}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Print Button */}
                        <button
                            onClick={handlePrint}
                            className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Imprimer"
                        >
                            <Printer className="h-5 w-5" />
                        </button>

                        {/* Download Button */}
                        <a
                            href={pdfUrl}
                            download={`facture_${invoiceNumber}.pdf`}
                            className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Télécharger"
                        >
                            <Download className="h-5 w-5" />
                        </a>

                        <button
                            onClick={onClose}
                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* PDF Viewer */}
                <div className="flex-1 bg-slate-900/50 relative">
                    <iframe
                        ref={iframeRef}
                        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full border-none"
                        title="PDF Preview"
                    />
                </div>
            </div>
        </div>
    );
}
