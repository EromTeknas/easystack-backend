const fs = require('fs');
let content = fs.readFileSync('src/services/collaboration.service.ts', 'utf8');

const origRequestReview = `    if (request) {
      // Re-open if it was previously approved
      request.status = 'PENDING';
      await request.save();
    } else {
      request = await FeedReviewRequest.create({
        feedLocalizationId: loc._id,
        requestedUserId,
        requestedByUserId: requesterUserId,
        status: 'PENDING'
      });
    }

    await FeedAuditLog.create({`;

const newRequestReview = `    if (request) {
      // Re-open if it was previously approved
      request.status = 'PENDING';
      await request.save();
    } else {
      request = await FeedReviewRequest.create({
        feedLocalizationId: loc._id,
        requestedUserId,
        requestedByUserId: requesterUserId,
        status: 'PENDING'
      });
    }

    // Mock Email sending
    console.log(\`[EMAIL MOCK] Sending email to User \${requestedUserId} for feed \${feedId} (\${language})\`);
    console.log(\`[EMAIL MOCK] Subject: Review Requested - Feed \${feedId}\`);
    console.log(\`[EMAIL MOCK] Body: User \${requesterUserId} has requested your review on the \${language.toUpperCase()} translation for Feed \${feedId}.\`);

    await FeedAuditLog.create({`;

content = content.replace(origRequestReview, newRequestReview);
fs.writeFileSync('src/services/collaboration.service.ts', content);
