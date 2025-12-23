import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { Suspense } from "react";

export default function NewDevisPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <InvoiceEditor type="Devis" />
        </Suspense>
    );
}
