// adminorg/load-env.js
// --- Custom environment loader that supports loading from .env and falls back to .htaccess SetEnv variables ---

const fs = require('fs');
const path = require('path');

// Resolve paths relative to this file's directory (adminorg root)
const envPath = path.resolve(__dirname, '.env');
const htaccessPath = path.resolve(__dirname, '.htaccess');

// 1. Try to load variables from .env
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath, quiet: true });
} else {
    // If no .env is present, still call dotenv.config() to load standard process envs
    require('dotenv').config({ quiet: true });
}

// 2. Parse .htaccess as a fallback (specifically for LiteSpeed/Passenger environment)
try {
    if (fs.existsSync(htaccessPath)) {
        const htaccessContent = fs.readFileSync(htaccessPath, 'utf8');
        const lines = htaccessContent.split(/\r?\n/);
        lines.forEach(line => {
            const trimmed = line.trim();
            // Match SetEnv lines (case insensitive for "SetEnv")
            const match = trimmed.match(/^SetEnv\s+([A-Za-z0-9_]+)\s+(.+)$/i);
            if (match) {
                const key = match[1];
                let val = match[2].trim();
                // Strip surrounding quotes if present
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.substring(1, val.length - 1);
                }
                // Only write to process.env if the key is not already defined
                if (!process.env[key]) {
                    process.env[key] = val;
                }
            }
        });
    }
} catch (error) {
    console.error('Warning: Failed to load environment variables from .htaccess fallback:', error.message);
}
