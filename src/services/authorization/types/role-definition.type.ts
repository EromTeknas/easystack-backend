import { Permission } from "../constants/permission.constants";

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
}