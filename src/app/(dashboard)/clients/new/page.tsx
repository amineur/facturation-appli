import { Suspense } from "react";
import { ClientEditor } from "@/components/features/ClientEditor";

export const dynamic = 'force-dynamic';

export default function NewClientPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <ClientEditor />
        </Suspense>
    );
}
