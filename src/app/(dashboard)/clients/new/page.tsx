import { Suspense } from "react";
import { ClientEditor } from "@/components/features/ClientEditor";

export default function NewClientPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <ClientEditor />
        </Suspense>
    );
}
