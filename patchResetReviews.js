const fs = require('fs');
let content = fs.readFileSync('src/services/feed.service.ts', 'utf8');

// 1. In updateDraftBaseContent
const origBase = `    // Mark all other translations as STALE so frontend shows a warning
    await FeedLocalization.updateMany(
      { 
        feedVersionId: feedVersion._id, 
        languageCode: { $ne: feedVersion.baseLanguage } 
      },
      { 
        $set: { status: 'STALE' } 
      }
    );`;

const fixBase = `    // Mark all other translations as STALE so frontend shows a warning
    await FeedLocalization.updateMany(
      { 
        feedVersionId: feedVersion._id, 
        languageCode: { $ne: feedVersion.baseLanguage } 
      },
      { 
        $set: { status: 'STALE' } 
      }
    );

    // Get all those localization IDs
    const staleLocs = await FeedLocalization.find(
      { feedVersionId: feedVersion._id, languageCode: { $ne: feedVersion.baseLanguage } },
      { _id: 1 }
    ).lean();
    
    // Reset any APPROVED reviews back to PENDING because the base changed!
    if (staleLocs.length > 0) {
      await FeedReviewRequest.updateMany(
        { feedLocalizationId: { $in: staleLocs.map(l => l._id) }, status: 'APPROVED' },
        { $set: { status: 'PENDING' } }
      );
    }`;
content = content.replace(origBase, fixBase);

// 2. In updateDraftLocalization
const origLoc = `    loc.localizedContent = localizedContent;
    loc.status = 'COMPLETED';
    await loc.save();`;

const fixLoc = `    loc.localizedContent = localizedContent;
    loc.status = 'COMPLETED';
    await loc.save();

    // Reset any APPROVED reviews back to PENDING because the translation content was manually edited
    await FeedReviewRequest.updateMany(
      { feedLocalizationId: loc._id, status: 'APPROVED' },
      { $set: { status: 'PENDING' } }
    );`;
content = content.replace(origLoc, fixLoc);

fs.writeFileSync('src/services/feed.service.ts', content);
