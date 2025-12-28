
import { fetchSocietes, getDefaultUser } from '../src/app/actions';

async function main() {
    console.log("Running Verification for Refactored Actions...");

    try {
        // Test 1: Fetch Societes (Simple read)
        console.log("Testing fetchSocietes...");
        const societes = await fetchSocietes();
        if (societes.success) {
            console.log("✅ fetchSocietes success. IDs:", societes.data?.map((s: any) => s.id));
        } else {
            console.error("❌ fetchSocietes failed:", societes.error);
        }

        // Test 2: Get Default User (Auth dependency)
        console.log("Testing getDefaultUser...");
        const user = await getDefaultUser();
        if (user.success) {
            console.log("✅ getDefaultUser success. User:", user.data?.email);
        } else {
            console.error("❌ getDefaultUser failed:", user.error);
        }

        console.log("Verification Complete.");
    } catch (error) {
        console.error("Verification Crashed:", error);
        process.exit(1);
    }
}

main();
