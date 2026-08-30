const fs = require('fs');
let content = fs.readFileSync('src/services/collaboration.service.ts', 'utf8');

const badCreate = `    const comment = await FeedComment.create({
      workspaceId,
      projectId,
      feedLocalizationId: loc._id,
      authorId,
      parentId: payload.parentId || null,
      jsonPath: payload.jsonPath,
      content: payload.content,
      mentions: payload.mentions || [],
      status: 'ACTIVE'
    });`;

const goodCreate = `    const createPayload: any = {
      workspaceId,
      projectId,
      feedLocalizationId: loc._id,
      authorId,
      parentId: payload.parentId || null,
      content: payload.content,
      mentions: payload.mentions || [],
      status: 'ACTIVE'
    };
    if (payload.jsonPath) {
      createPayload.jsonPath = payload.jsonPath;
    }

    const comment = await FeedComment.create(createPayload);`;

content = content.replace(badCreate, goodCreate);
fs.writeFileSync('src/services/collaboration.service.ts', content);
