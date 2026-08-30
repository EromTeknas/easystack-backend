const fs = require('fs');
let content = fs.readFileSync('src/routes/feeds/collaboration.controller.ts', 'utf8');

const origImport = "import { asyncHandler, ok } from '../../utils/responseHandler';";
const newImport = "import { asyncHandler } from '../../utils/asyncHandler';\\nimport { ok } from '../../utils/response';";

content = content.replace(origImport, newImport);
fs.writeFileSync('src/routes/feeds/collaboration.controller.ts', content.replace(/\\n/g, '\n'));
