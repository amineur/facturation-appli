const query = "44306184100047"; // Google France
fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${query}&per_page=1`, {
    headers: { 'Accept': 'application/json' }
})
    .then(res => res.json())
    .then(data => {
        if (data.results && data.results.length > 0) {
            const company = data.results[0];
            console.log(JSON.stringify(company, null, 2));

            // Test my logic
            const address = [
                company.etablissement_siege?.numero_voie,
                company.etablissement_siege?.type_voie,
                company.etablissement_siege?.libelle_voie
            ].filter(Boolean).join(" ");
            console.log("Constructed Address:", address);
        }
    });
