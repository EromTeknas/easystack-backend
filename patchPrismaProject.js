const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const origProject = `model Project {
  id Int @id @default(autoincrement())
  workspaceId Int @map("workspace_id")
  name String
  description String?
  supportedLanguages Json @default("[]") @map("supported_languages")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")`;

const newProject = `model Project {
  id Int @id @default(autoincrement())
  workspaceId Int @map("workspace_id")
  name String
  description String?
  supportedLanguages Json @default("[]") @map("supported_languages")
  requireApprovalsForRelease Boolean @default(false) @map("require_approvals_for_release")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")`;

content = content.replace(origProject, newProject);
fs.writeFileSync('prisma/schema.prisma', content);
