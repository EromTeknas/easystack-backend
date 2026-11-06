export interface DefaultEnvironmentConfig {
  name: string;
  displayName: string;
  rank: number;
  isEditable: boolean;
  requiresApproval?: boolean;
}

export const DEFAULT_ENVIRONMENTS: DefaultEnvironmentConfig[] = [
  {
    name: 'development',
    displayName: 'Development',
    rank: 10,
    isEditable: true,
    requiresApproval: false,
  },
  {
    name: 'live',
    displayName: 'Live',
    rank: 50,
    isEditable: false,
    requiresApproval: false,
  },
];

export const MAX_PROJECT_ENVIRONMENTS = 5;
