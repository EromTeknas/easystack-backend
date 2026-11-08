import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Quotas, getQuotaDefinition, formatQuotaDisplayName } from '../src/services/billing/config/quotas.config';
import { PlanRegistry } from '../src/services/billing/config/plans';
import { FreePlan } from '../src/services/billing/config/plans/free.plan';
import { ProPlan } from '../src/services/billing/config/plans/pro.plan';

describe('Dynamic Billing Quotas and Scope Detection', () => {
  it('defines all quotas with explicit scopes and display names', () => {
    for (const [key, quota] of Object.entries(Quotas)) {
      assert.ok(quota.key, `Quota ${key} must have a key`);
      assert.ok(quota.displayName, `Quota ${key} must have a displayName`);
      assert.ok(quota.unit, `Quota ${key} must have a unit`);
      assert.ok(quota.scope === 'WORKSPACE' || quota.scope === 'PROJECT', `Quota ${key} must have scope WORKSPACE or PROJECT`);
    }
  });

  it('marks asset_storage_mb as PROJECT scope with clean displayName', () => {
    const quota = getQuotaDefinition('asset_storage_mb');
    assert.ok(quota, 'asset_storage_mb definition must exist');
    assert.strictEqual(quota.scope, 'PROJECT');
    assert.strictEqual(quota.displayName, 'Asset Storage');
    assert.strictEqual(quota.unit, 'MB');
  });

  it('formats quota keys into clean Title Case labels', () => {
    assert.strictEqual(formatQuotaDisplayName('asset_storage_mb'), 'Asset Storage');
    assert.strictEqual(formatQuotaDisplayName('storage.gb'), 'Storage');
    assert.strictEqual(formatQuotaDisplayName('environments_per_project'), 'Environments');
    assert.strictEqual(formatQuotaDisplayName('api.requests.daily'), 'API Requests (Daily)');
    // Custom / future keys
    assert.strictEqual(formatQuotaDisplayName('custom_domains_per_project'), 'Custom Domains Per Project');
    assert.strictEqual(formatQuotaDisplayName('ai_tokens_monthly'), 'Ai Tokens Monthly');
  });

  it('ensures FreePlan and ProPlan include all required project and workspace quotas', () => {
    const expectedKeys = [
      Quotas.PROJECTS.key,
      Quotas.MEMBERS.key,
      Quotas.ENVIRONMENTS_PER_PROJECT.key,
      Quotas.BLUEPRINTS_PER_PROJECT.key,
      Quotas.DATA_ENTRIES_PER_PROJECT.key,
      Quotas.ASSET_STORAGE_MB.key,
    ];

    for (const key of expectedKeys) {
      assert.ok(key in FreePlan.quotas, `FreePlan must define quota for ${key}`);
      assert.ok(key in ProPlan.quotas, `ProPlan must define quota for ${key}`);
    }

    assert.strictEqual((FreePlan.quotas as any)[Quotas.ASSET_STORAGE_MB.key], 50);
    assert.strictEqual((ProPlan.quotas as any)[Quotas.ASSET_STORAGE_MB.key], 2048);
  });

  it('PlanRegistry exposes all registered plans as source of truth', () => {
    assert.ok(Array.isArray(PlanRegistry));
    const free = PlanRegistry.find(p => p.key === 'free');
    const pro = PlanRegistry.find(p => p.key === 'pro');
    assert.ok(free, 'Free plan must be registered');
    assert.ok(pro, 'Pro plan must be registered');
  });
});
