
import { spawn } from 'child_process';
import { resolve } from 'path';

const dbFiles = [
    './prisma/dev.db',
    './prisma/recovered_prisma.db',
    './prisma/recovered_root.db',
    './prisma/dev.db"DATABASE_URL="file:./dev.db',
    './dev.db"DATABASE_URL="file:./dev.db',
    './data/dev.db'
];

const tables = ['Facture', 'Devis', 'User', 'Societe'];

async function runQuery(dbPath: string, query: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const process = spawn('sqlite3', [dbPath, query]);
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                // If table doesn't exist or other error, return error string
                resolve(`Error: ${stderr.trim().split('\n')[0]}`);
            } else {
                resolve(stdout.trim());
            }
        });

        process.on('error', (err) => {
            resolve(`Spawn Error: ${err.message}`);
        })
    });
}

async function main() {
    const results = [];

    for (const file of dbFiles) {
        const counts: Record<string, string> = {};
        for (const table of tables) {
            const count = await runQuery(file, `SELECT count(*) FROM ${table};`);
            counts[table] = count;
        }
        results.push({
            file,
            counts
        });
    }

    console.log(JSON.stringify(results, null, 2));
}

main();
