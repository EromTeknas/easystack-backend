import { PermissionConfig } from "../configs/permission.config.ts";
import { generatePermissions } from "../generators/permission.generator";

export const PERMISSIONS = generatePermissions(PermissionConfig);

type Resource = keyof typeof PermissionConfig;

type Action<R extends Resource> = (typeof PermissionConfig)[R][number];

export type Permission = {
  [R in Resource]: `${R}:${Action<R>}`;
}[Resource];