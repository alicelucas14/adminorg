// backend/scripts/copy-db.js
// --- ONE-OFF TOOL: COPY EVERY COLLECTION (DOCUMENTS + INDEXES) FROM ONE MONGODB DATABASE TO ANOTHER ---
//
// The SOURCE is only ever read. Connection strings come from environment variables so passwords never
// appear on the command line or in shell history:
//
//   read -rs TARGET_URI; export TARGET_URI          # type the target connection string (nothing is echoed)
//   node scripts/copy-db.js --dry-run               # look first: counts and indexes, writes nothing
//   node scripts/copy-db.js                         # copy (refuses if the target already holds data)
//   node scripts/copy-db.js --replace               # re-copy: drops only the target collections that exist in the source
//
// SOURCE_URI defaults to MONGO_URI from this app's .env, so you normally only set TARGET_URI.
// Both URIs must name a database (mongodb://user:pass@host:27017/dbname?authSource=...).

require('../load-env');

const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const REPLACE = args.has('--replace');
const BATCH = 500;

const sourceUri = process.env.SOURCE_URI || process.env.MONGO_URI;
const targetUri = process.env.TARGET_URI;

function fail(message) {
    console.error('ERROR: ' + message);
    process.exit(1);
}

// "host:port/db" with no credentials, for display and for the "same database?" guard.
function describe(uri) {
    try {
        const u = new URL(uri);
        return `${u.host}${u.pathname}`;
    } catch {
        return '(unparseable connection string)';
    }
}

if (!sourceUri) fail('No source: set SOURCE_URI, or MONGO_URI in this app\'s .env.');
if (!targetUri) fail('No target: set TARGET_URI (tip: read -rs TARGET_URI; export TARGET_URI).');
if (describe(sourceUri) === describe(targetUri)) fail('Source and target are the same database. Refusing.');

const idDigest = (ids) =>
    crypto.createHash('sha1').update(ids.map(String).sort().join('|')).digest('hex');

async function main() {
    const sourceClient = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 10000 });
    const targetClient = new MongoClient(targetUri, { serverSelectionTimeoutMS: 10000 });
    await Promise.all([sourceClient.connect(), targetClient.connect()]);

    try {
        const src = sourceClient.db();
        const dst = targetClient.db();
        console.log(`source: ${describe(sourceUri)}`);
        console.log(`target: ${describe(targetUri)}${DRY_RUN ? '   (dry run: nothing will be written)' : ''}\n`);

        const sourceInfos = (await src.listCollections({ type: 'collection' }).toArray())
            .filter((c) => !c.name.startsWith('system.'))
            .sort((a, b) => a.name.localeCompare(b.name));
        const sourceCollections = sourceInfos.map((c) => c.name);
        const optionsOf = new Map(sourceInfos.map((c) => [c.name, c.options || {}]));
        const targetCollections = (await dst.listCollections({ type: 'collection' }).toArray())
            .map((c) => c.name)
            .filter((n) => !n.startsWith('system.'));

        // Safety: never mix into a database that already has data.
        const occupied = [];
        for (const name of targetCollections) {
            if ((await dst.collection(name).estimatedDocumentCount()) > 0) occupied.push(name);
        }
        const clash = occupied.filter((n) => sourceCollections.includes(n));
        if (occupied.length && !REPLACE) {
            fail(`The target database already has data in: ${occupied.join(', ')}.\n` +
                 '       Nothing was changed. Use a new empty database, or re-run with --replace to overwrite the\n' +
                 '       collections that exist in the source.');
        }

        let mismatches = 0;
        console.log('collection'.padEnd(22) + 'documents'.padStart(10) + 'indexes'.padStart(9) + '   result');
        for (const name of sourceCollections) {
            const from = src.collection(name);
            const to = dst.collection(name);
            const total = await from.countDocuments();
            const indexes = (await from.indexes()).filter((i) => i.name !== '_id_');

            if (DRY_RUN) {
                console.log(name.padEnd(22) + String(total).padStart(10) + String(indexes.length).padStart(9) + '   (dry run)');
                continue;
            }

            if (REPLACE && clash.includes(name)) await to.drop();
            // Create the collection explicitly (with its options) so empty collections are copied too.
            await dst.createCollection(name, optionsOf.get(name)).catch((e) => { if (e.code !== 48) throw e; });

            let copied = 0;
            let batch = [];
            const flush = async () => {
                if (!batch.length) return;
                await to.insertMany(batch, { ordered: false, bypassDocumentValidation: true });
                copied += batch.length;
                batch = [];
            };
            for await (const doc of from.find({}, { batchSize: BATCH })) {
                batch.push(doc);
                if (batch.length >= BATCH) await flush();
            }
            await flush();

            for (const idx of indexes) {
                const { v, key, ns, background, ...options } = idx;
                await to.createIndex(key, options);
            }

            // Verify: same count, same set of _ids, same index names.
            const [toCount, fromIds, toIds, toIndexes] = await Promise.all([
                to.countDocuments(),
                from.find({}, { projection: { _id: 1 } }).map((d) => d._id).toArray(),
                to.find({}, { projection: { _id: 1 } }).map((d) => d._id).toArray(),
                to.indexes(),
            ]);
            const sameIds = idDigest(fromIds) === idDigest(toIds);
            const sameIndexes = idx2(indexes) === idx2(toIndexes.filter((i) => i.name !== '_id_'));
            const ok = toCount === total && copied === total && sameIds && sameIndexes;
            if (!ok) mismatches++;
            console.log(
                name.padEnd(22) + String(total).padStart(10) + String(indexes.length).padStart(9) +
                '   ' + (ok ? 'OK' : `MISMATCH (copied ${copied}, target has ${toCount}, ids ${sameIds ? 'match' : 'DIFFER'}, indexes ${sameIndexes ? 'match' : 'DIFFER'})`)
            );
        }

        const empty = sourceCollections.filter(Boolean).length === 0;
        if (empty) console.log('(the source database has no collections)');
        if (DRY_RUN) {
            console.log('\nDry run only. Nothing was written.');
        } else if (mismatches) {
            console.error(`\n${mismatches} collection(s) did NOT copy cleanly. Do not switch the app to the target.`);
            process.exitCode = 1;
        } else {
            console.log('\nAll collections copied and verified (counts, _id sets, indexes). The source was not modified.');
        }
    } finally {
        await Promise.allSettled([sourceClient.close(), targetClient.close()]);
    }
}

// Index identity for comparison: name + key + the options that change behaviour.
function idx2(list) {
    return JSON.stringify(
        list
            .map((i) => ({ name: i.name, key: i.key, unique: !!i.unique, sparse: !!i.sparse, ttl: i.expireAfterSeconds ?? null, partial: i.partialFilterExpression ?? null }))
            .sort((a, b) => a.name.localeCompare(b.name))
    );
}

main().catch((err) => fail(err.message));
