import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { Suspense } from "react";

export default function NewFacturePage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <InvoiceEditor type="Facture" />
        </Suspense>
    );
}
