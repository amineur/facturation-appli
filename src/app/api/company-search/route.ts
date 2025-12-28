import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q");

        if (!query) {
            return NextResponse.json({ error: "Query required" }, { status: 400 });
        }

        const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${query}&per_page=5`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            return NextResponse.json({ error: "API Error" }, { status: response.status });
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const results = data.results.map((company: any) => {
                const siege = company.siege;
                const siren = company.siren;
                const tvaKey = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
                const tvaKeyStr = tvaKey.toString().padStart(2, '0');
                const tvaIntra = `FR${tvaKeyStr}${siren}`;

                return {
                    nom: company.nom_complet,
                    siret: company.siret,
                    adresse: siege ? [
                        siege.numero_voie,
                        siege.type_voie,
                        siege.libelle_voie
                    ].filter(Boolean).join(" ") : company.adresse,
                    codePostal: siege?.code_postal || company.code_postal,
                    ville: siege?.libelle_commune || company.libelle_commune,
                    formeJuridique: mapLegalForm(company.nature_juridique),
                    tvaIntra: tvaIntra
                };
            });

            return NextResponse.json({
                success: true,
                results: results
            });
        }

        return NextResponse.json({ success: false, error: "Aucun résultat" });

    } catch (error: any) {
        console.error("Siret Lookup Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function mapLegalForm(form: string): string {
    if (!form) return "";

    // Check if it's a code
    if (/^\d+$/.test(form)) {
        const code = parseInt(form, 10);
        if (code === 1000) return "EI (Entreprise Individuelle)";
        if (code === 5499) return "SARL";
        if (code === 5498) return "EURL";
        if (code === 5710) return "SAS";
        if (code === 5720) return "SASU"; // Often SASU shares SAS code or specific
        if (code === 5599) return "SA";
        if (code === 6540 || code === 6599) return "SCI";
        // Fallback for codes
        return "Autre";
    }

    // Text matching
    const lower = form.toLowerCase();
    if (lower.includes("responsabilité limitée")) return "SARL";
    if (lower.includes("par actions simplifiée") && lower.includes("unipersonnelle")) return "SASU";
    if (lower.includes("par actions simplifiée")) return "SAS";
    if (lower.includes("anonyme")) return "SA";
    if (lower.includes("civile immobilière")) return "SCI";
    if (lower.includes("entrepreneur individuel")) return "EI (Entreprise Individuelle)";
    if (lower.includes("auto-entrepreneur") || lower.includes("micro-entrepreneur") || lower.includes("micro entrepreneur")) return "Auto-entrepreneur";

    return "Autre";
}
