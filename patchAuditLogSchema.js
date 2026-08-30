const fs = require('fs');
let content = fs.readFileSync('src/models/feed-audit-log.model.ts', 'utf8');

const origType = "action: 'CREATED_VERSION' | 'UPDATED_BASE' | 'UPDATED_TRANSLATION' | 'GENERATED_TRANSLATION';";
const newType = "action: 'CREATED_VERSION' | 'UPDATED_BASE' | 'UPDATED_TRANSLATION' | 'GENERATED_TRANSLATION' | 'REQUESTED_REVIEW' | 'APPROVED_TRANSLATION' | 'REQUESTED_CHANGES' | 'ADDED_COMMENT' | 'RESOLVED_COMMENT';";
content = content.replace(origType, newType);

const origEnum = "enum: ['CREATED_VERSION', 'UPDATED_BASE', 'UPDATED_TRANSLATION', 'GENERATED_TRANSLATION'],";
const newEnum = "enum: ['CREATED_VERSION', 'UPDATED_BASE', 'UPDATED_TRANSLATION', 'GENERATED_TRANSLATION', 'REQUESTED_REVIEW', 'APPROVED_TRANSLATION', 'REQUESTED_CHANGES', 'ADDED_COMMENT', 'RESOLVED_COMMENT'],";
content = content.replace(origEnum, newEnum);

fs.writeFileSync('src/models/feed-audit-log.model.ts', content);
