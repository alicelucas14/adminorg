// ===== backend/lib/linkChecker.js =====

const { BlogPost, Page, Review, Promotion, Setting, LinkCheckResult } = require('../models');

// In-memory state tracking for active scans
let isScanning = false;
let totalLinks = 0;
let checkedLinks = 0;
let lastScanDate = null;

// Cache of checked URLs during a single scan run to prevent duplicate HTTP requests
const checkedCache = new Map();

/**
 * Get current scan progress and status
 */
function getScanStatus() {
    return {
        isScanning,
        total: totalLinks,
        checked: checkedLinks,
        lastScanDate
    };
}

/**
 * Extract links from Markdown and HTML text content
 */
function extractLinks(text, sourceModel, sourceId, sourceTitle, sourceFieldName, frontendUrl) {
    const extracted = [];
    if (!text || typeof text !== 'string') return extracted;

    const addLink = (url, anchorText) => {
        if (!url || typeof url !== 'string') return;
        
        let cleanedUrl = url.trim();
        
        // Skip non-http/s links
        if (cleanedUrl.startsWith('#') || 
            cleanedUrl.startsWith('mailto:') || 
            cleanedUrl.startsWith('tel:') || 
            cleanedUrl.startsWith('javascript:')) {
            return;
        }

        // Determine if internal or external
        let type = 'external';
        let resolvedUrl = cleanedUrl;

        if (cleanedUrl.startsWith('/') || !cleanedUrl.startsWith('http')) {
            type = 'internal';
            if (!cleanedUrl.startsWith('/')) {
                cleanedUrl = '/' + cleanedUrl;
            }
            try {
                resolvedUrl = new URL(cleanedUrl, frontendUrl).href;
            } catch (e) {
                resolvedUrl = frontendUrl + cleanedUrl;
            }
        } else {
            if (cleanedUrl.startsWith(frontendUrl)) {
                type = 'internal';
            }
        }

        extracted.push({
            url: cleanedUrl,
            resolvedUrl,
            type,
            anchorText: anchorText || cleanedUrl,
            sourceModel,
            sourceId,
            sourceTitle,
            sourceFieldName
        });
    };

    // 1. Extract markdown links: [Anchor Text](URL)
    // Matches markdown links that do not start with ! (which are images)
    const mdLinkRegex = /(?:^|[^!])\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = mdLinkRegex.exec(text)) !== null) {
        // match[1] = anchorText, match[2] = url
        addLink(match[2], match[1]);
    }

    // Reset regex index
    mdLinkRegex.lastIndex = 0;

    // 2. Extract HTML links: <a href="URL">Anchor Text</a>
    const htmlRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    while ((match = htmlRegex.exec(text)) !== null) {
        // match[1] = url, match[2] = anchorText
        const anchor = match[2].replace(/<[^>]+>/g, '').trim(); // strip nested HTML tags in anchor
        addLink(match[1], anchor);
    }

    return extracted;
}

/**
 * Check an individual URL status using HTTP fetch.
 * Uses HEAD first, falls back to GET on non-ok statuses.
 */
async function checkUrl(resolvedUrl) {
    if (checkedCache.has(resolvedUrl)) {
        return checkedCache.get(resolvedUrl);
    }

    let isWorking = false;
    let statusCode = null;
    let errorMessage = null;

    const requestHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UU7GameLinkChecker/1.0',
        'Accept': '*/*'
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

        // Try HEAD request first for speed and bandwidth
        const res = await fetch(resolvedUrl, {
            method: 'HEAD',
            signal: controller.signal,
            headers: requestHeaders
        });
        clearTimeout(timeoutId);

        statusCode = res.status;

        if (res.ok) {
            isWorking = true;
        } else {
            // Some servers block HEAD or return 405/403. Fall back to GET.
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), 8000);

            const res2 = await fetch(resolvedUrl, {
                method: 'GET',
                signal: controller2.signal,
                headers: requestHeaders
            });
            clearTimeout(timeoutId2);

            statusCode = res2.status;
            if (res2.ok) {
                isWorking = true;
            } else {
                errorMessage = `HTTP Status ${res2.status}`;
            }
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            errorMessage = 'Timeout (8s)';
        } else {
            errorMessage = err.message || 'Connection Refused';
        }
    }

    const result = { isWorking, statusCode, errorMessage };
    checkedCache.set(resolvedUrl, result);
    return result;
}

/**
 * Helper to run promises with a concurrency limit
 */
async function runConcurrent(limit, tasks, fn) {
    const results = [];
    const executing = [];
    
    for (const task of tasks) {
        const p = Promise.resolve().then(() => fn(task));
        results.push(p);
        
        if (limit <= tasks.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(results);
}

/**
 * Start the asynchronous link scanning process
 */
async function runLinkScan(frontendUrl) {
    if (isScanning) return;

    isScanning = true;
    totalLinks = 0;
    checkedLinks = 0;
    checkedCache.clear();

    try {
        console.log(`[LinkChecker] Starting link check scan targeting frontend URL: ${frontendUrl}`);
        const allExtractedLinks = [];

        // 1. Gather all documents
        const [posts, pages, reviews, promotions, settingsList] = await Promise.all([
            BlogPost.find({}).lean(),
            Page.find({}).lean(),
            Review.find({}).lean(),
            Promotion.find({}).lean(),
            Setting.find({}).lean()
        ]);

        // 2. Extract links from BlogPosts
        for (const post of posts) {
            const title = post.title?.en || post.slug;
            allExtractedLinks.push(...extractLinks(post.body?.en, 'BlogPost', post._id, title, 'body.en', frontendUrl));
            allExtractedLinks.push(...extractLinks(post.body?.hi, 'BlogPost', post._id, title, 'body.hi', frontendUrl));
            allExtractedLinks.push(...extractLinks(post.excerpt?.en, 'BlogPost', post._id, title, 'excerpt.en', frontendUrl));
            allExtractedLinks.push(...extractLinks(post.excerpt?.hi, 'BlogPost', post._id, title, 'excerpt.hi', frontendUrl));
        }

        // 3. Extract links from Pages
        for (const page of pages) {
            const title = page.title?.en || page.slug;
            allExtractedLinks.push(...extractLinks(page.body?.en, 'Page', page._id, title, 'body.en', frontendUrl));
            allExtractedLinks.push(...extractLinks(page.body?.hi, 'Page', page._id, title, 'body.hi', frontendUrl));
        }

        // 4. Extract links from Reviews
        for (const review of reviews) {
            const title = review.title?.en || review.gameName;
            allExtractedLinks.push(...extractLinks(review.body?.en, 'Review', review._id, title, 'body.en', frontendUrl));
            allExtractedLinks.push(...extractLinks(review.body?.hi, 'Review', review._id, title, 'body.hi', frontendUrl));
            allExtractedLinks.push(...extractLinks(review.excerpt?.en, 'Review', review._id, title, 'excerpt.en', frontendUrl));
            allExtractedLinks.push(...extractLinks(review.excerpt?.hi, 'Review', review._id, title, 'excerpt.hi', frontendUrl));
        }

        // 5. Extract links from Promotions
        for (const promo of promotions) {
            const title = promo.title?.en || 'Promotion';
            allExtractedLinks.push(...extractLinks(promo.description?.en, 'Promotion', promo._id, title, 'description.en', frontendUrl));
            allExtractedLinks.push(...extractLinks(promo.description?.hi, 'Promotion', promo._id, title, 'description.hi', frontendUrl));
            if (promo.ctaLink) {
                // Add direct link
                const ctaUrl = promo.ctaLink.trim();
                if (ctaUrl && ctaUrl !== '#') {
                    allExtractedLinks.push({
                        url: ctaUrl,
                        resolvedUrl: ctaUrl.startsWith('/') || !ctaUrl.startsWith('http') ? new URL(ctaUrl.startsWith('/') ? ctaUrl : '/' + ctaUrl, frontendUrl).href : ctaUrl,
                        type: ctaUrl.startsWith('/') || !ctaUrl.startsWith('http') || ctaUrl.startsWith(frontendUrl) ? 'internal' : 'external',
                        anchorText: 'CTA Link',
                        sourceModel: 'Promotion',
                        sourceId: promo._id,
                        sourceTitle: title,
                        sourceFieldName: 'ctaLink'
                    });
                }
            }
        }

        // 6. Extract links from Settings
        for (const settings of settingsList) {
            const title = settings.siteName || 'Site Settings';
            const urlFields = [
                'apkDownloadLink', 'telegramUrl', 'whatsappUrl', 'instagramUrl', 
                'facebookUrl', 'youtubeUrl', 'twitterUrl', 'liveChatUrl'
            ];
            for (const field of urlFields) {
                const val = settings[field];
                if (val && val.trim() && val.trim() !== '#' && !val.trim().startsWith('/api/')) {
                    const cleanedVal = val.trim();
                    allExtractedLinks.push({
                        url: cleanedVal,
                        resolvedUrl: cleanedVal.startsWith('/') || !cleanedVal.startsWith('http') ? new URL(cleanedVal.startsWith('/') ? cleanedVal : '/' + cleanedVal, frontendUrl).href : cleanedVal,
                        type: cleanedVal.startsWith('/') || !cleanedVal.startsWith('http') || cleanedVal.startsWith(frontendUrl) ? 'internal' : 'external',
                        anchorText: field,
                        sourceModel: 'Setting',
                        sourceId: settings._id,
                        sourceTitle: title,
                        sourceFieldName: field
                    });
                }
            }
        }

        totalLinks = allExtractedLinks.length;
        console.log(`[LinkChecker] Found ${totalLinks} total links to check.`);

        // 7. Check all links concurrently
        const scanResults = await runConcurrent(5, allExtractedLinks, async (item) => {
            const statusResult = await checkUrl(item.resolvedUrl);
            checkedLinks++;
            
            return {
                url: item.url,
                resolvedUrl: item.resolvedUrl,
                type: item.type,
                status: statusResult.isWorking ? 'working' : 'broken',
                statusCode: statusResult.statusCode,
                errorMessage: statusResult.errorMessage,
                anchorText: item.anchorText,
                sourceModel: item.sourceModel,
                sourceId: item.sourceId,
                sourceTitle: item.sourceTitle,
                sourceFieldName: item.sourceFieldName
            };
        });

        // 8. Bulk write results to MongoDB
        // Clear old results and insert new ones
        await LinkCheckResult.deleteMany({});
        if (scanResults.length > 0) {
            await LinkCheckResult.insertMany(scanResults);
        }

        lastScanDate = new Date();
        console.log(`[LinkChecker] Completed scan. Checked ${checkedLinks}/${totalLinks} links. Saved results to DB.`);
    } catch (err) {
        console.error('[LinkChecker] Error during link scan:', err);
    } finally {
        isScanning = false;
        checkedCache.clear();
    }
}

module.exports = {
    getScanStatus,
    runLinkScan
};
