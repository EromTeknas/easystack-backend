import { SchemaBlueprintRepository, CreateSchemaBlueprintDto, UpdateSchemaBlueprintDto } from '../repositories/schema-blueprint.repository';
import { FeedSchemaValidationService } from './feed-schema-validation.service';
import { BadRequestError, NotFoundError, ConflictError } from '../errors';
import { prisma } from '../db';
import { ISchemaBlueprint } from '../models/schema-blueprint.model';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SchemaBlueprintService = {
  async assertProjectExists(projectId: number) {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('Invalid projectId');
    }
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project;
  },

  async listSchemas(projectId: number, environment?: string): Promise<ISchemaBlueprint[]> {
    await this.assertProjectExists(projectId);
    const all = await SchemaBlueprintRepository.listByProject(projectId);
    const cleanEnv = (environment || 'development').toLowerCase().trim();
    if (cleanEnv === 'development') {
      return all;
    }

    const { SchemaBlueprintVersion } = await import('../models/schema-blueprint-version.model');
    const deployed: ISchemaBlueprint[] = [];

    for (const schema of all) {
      const verNum = Number((schema.environmentVersions as any)?.[cleanEnv]) || 0;
      if (verNum > 0) {
        const versionDoc = await SchemaBlueprintVersion.findOne({
          blueprintId: schema._id,
          versionNumber: verNum,
        });
        const obj = schema.toObject ? schema.toObject() : { ...schema };
        if (versionDoc && versionDoc.schemaDefinition) {
          obj.schemaDefinition = versionDoc.schemaDefinition;
        }
        deployed.push(obj as ISchemaBlueprint);
      }
    }

    return deployed;
  },

  async getSchemaById(projectId: number, id: string, environment?: string): Promise<ISchemaBlueprint> {
    await this.assertProjectExists(projectId);
    const schema = await SchemaBlueprintRepository.findById(id);
    if (!schema || schema.projectId !== projectId) {
      throw new NotFoundError('Schema blueprint not found in this project');
    }
    const cleanEnv = (environment || 'development').toLowerCase().trim();
    if (cleanEnv === 'development') {
      return schema;
    }
    const verNum = Number((schema.environmentVersions as any)?.[cleanEnv]) || 0;
    if (verNum <= 0) {
      throw new NotFoundError(`Schema blueprint is not deployed to '${cleanEnv}'`);
    }
    const { SchemaBlueprintVersion } = await import('../models/schema-blueprint-version.model');
    const versionDoc = await SchemaBlueprintVersion.findOne({
      blueprintId: schema._id,
      versionNumber: verNum,
    });
    if (versionDoc && versionDoc.schemaDefinition) {
      const obj = schema.toObject ? schema.toObject() : { ...schema };
      obj.schemaDefinition = versionDoc.schemaDefinition;
      return obj as ISchemaBlueprint;
    }
    return schema;
  },

  async getSchemaBySlug(projectId: number, slug: string, environment?: string): Promise<ISchemaBlueprint> {
    await this.assertProjectExists(projectId);
    const schema = await SchemaBlueprintRepository.findBySlug(projectId, slug);
    if (!schema) {
      throw new NotFoundError(`Schema blueprint '${slug}' not found in this project`);
    }
    const cleanEnv = (environment || 'development').toLowerCase().trim();
    if (cleanEnv === 'development') {
      return schema;
    }
    const verNum = Number((schema.environmentVersions as any)?.[cleanEnv]) || 0;
    if (verNum <= 0) {
      throw new NotFoundError(`Schema blueprint '${slug}' is not deployed to '${cleanEnv}'`);
    }
    const { SchemaBlueprintVersion } = await import('../models/schema-blueprint-version.model');
    const versionDoc = await SchemaBlueprintVersion.findOne({
      blueprintId: schema._id,
      versionNumber: verNum,
    });
    if (versionDoc && versionDoc.schemaDefinition) {
      const obj = schema.toObject ? schema.toObject() : { ...schema };
      obj.schemaDefinition = versionDoc.schemaDefinition;
      return obj as ISchemaBlueprint;
    }
    return schema;
  },

  async checkSlugAvailability(projectId: number, slug: string, excludeId?: string): Promise<{ available: boolean; reason?: string }> {
    await this.assertProjectExists(projectId);
    const cleanSlug = slug.toLowerCase().trim();
    if (!cleanSlug) {
      return { available: false, reason: 'Slug cannot be empty' };
    }
    if (!SLUG_REGEX.test(cleanSlug)) {
      return { 
        available: false, 
        reason: 'Slug must contain only lowercase letters, numbers, and hyphens (e.g. blog-posts)' 
      };
    }

    const existing = await SchemaBlueprintRepository.findBySlug(projectId, cleanSlug);
    if (existing && (!excludeId || existing._id.toString() !== excludeId)) {
      return { available: false, reason: 'A schema with this slug already exists in this project' };
    }

    return { available: true };
  },

  async createSchema(projectId: number, userId: number, data: Omit<CreateSchemaBlueprintDto, 'projectId' | 'createdBy'>): Promise<ISchemaBlueprint> {
    await this.assertProjectExists(projectId);

    if (!data.name || !data.name.trim()) {
      throw new BadRequestError('Schema name is required');
    }

    const cleanSlug = data.slug.toLowerCase().trim();
    const availability = await this.checkSlugAvailability(projectId, cleanSlug);
    if (!availability.available) {
      throw new ConflictError(availability.reason || 'Slug is not available');
    }

    // Validate schema definition if provided
    let validatedDefinition = data.schemaDefinition;
    if (validatedDefinition && validatedDefinition.fields && validatedDefinition.fields.length > 0) {
      validatedDefinition = FeedSchemaValidationService.validateSchemaDefinition(validatedDefinition);
    } else {
      validatedDefinition = { version: 1, fields: [] };
    }

    return SchemaBlueprintRepository.create({
      projectId,
      name: data.name.trim(),
      slug: cleanSlug,
      description: data.description?.trim() || '',
      type: data.type || 'collection',
      icon: data.icon || 'article',
      schemaDefinition: validatedDefinition,
      createdBy: userId,
    });
  },

  async updateSchema(projectId: number, id: string, data: UpdateSchemaBlueprintDto): Promise<ISchemaBlueprint> {
    await this.assertProjectExists(projectId);
    const existing = await this.getSchemaById(projectId, id);

    if (data.slug) {
      const cleanSlug = data.slug.toLowerCase().trim();
      if (cleanSlug !== existing.slug) {
        const availability = await this.checkSlugAvailability(projectId, cleanSlug, id);
        if (!availability.available) {
          throw new ConflictError(availability.reason || 'Slug is not available');
        }
      }
    }

    let validatedDefinition = data.schemaDefinition;
    let shouldBumpVersion = false;
    if (validatedDefinition) {
      validatedDefinition = FeedSchemaValidationService.validateSchemaDefinition(validatedDefinition);
      const prevDefStr = JSON.stringify(existing.schemaDefinition?.fields || []);
      const newDefStr = JSON.stringify(validatedDefinition?.fields || []);
      if (prevDefStr !== newDefStr) {
        shouldBumpVersion = true;
      }
    }

    const nextVersionNum = shouldBumpVersion
      ? (existing.activeVersionNumber || 1) + 1
      : (existing.activeVersionNumber || 1);

    const envVersions = { ...(existing.environmentVersions || {}) };
    envVersions.development = nextVersionNum;

    const updated = await SchemaBlueprintRepository.update(id, {
      ...data,
      schemaDefinition: validatedDefinition,
      activeVersionNumber: nextVersionNum,
      environmentVersions: envVersions,
    });

    if (!updated) {
      throw new NotFoundError('Failed to update schema blueprint');
    }

    return updated;
  },

  async deleteSchema(projectId: number, id: string): Promise<void> {
    await this.assertProjectExists(projectId);
    const existing = await this.getSchemaById(projectId, id);
    await SchemaBlueprintRepository.delete(existing._id.toString());
  },

  async deployBlueprint(
    projectId: number,
    id: string,
    targetEnv: string,
    userId: number
  ): Promise<{ schema: ISchemaBlueprint; release?: any; message: string; requiresApproval?: boolean }> {
    await this.assertProjectExists(projectId);
    const existing = await this.getSchemaById(projectId, id);
    const cleanEnv = targetEnv.toLowerCase().trim();

    // 1. Validate environments in MySQL project
    const envs = await prisma.environment.findMany({
      where: { projectId },
      orderBy: { rank: 'asc' },
    });

    const targetEnvironment = envs.find((e) => e.name.toLowerCase() === cleanEnv);
    if (!targetEnvironment) {
      throw new NotFoundError(`Target environment '${cleanEnv}' not configured in this project`);
    }

    const envVersions: Record<string, number> = { ...(existing.environmentVersions || {}) };
    const stagingVersion = envVersions['staging'] || 0;
    if (cleanEnv === 'production' && stagingVersion === 0) {
      throw new BadRequestError(
        'Blueprint must be deployed to Staging before deploying to Production. Follow the promotion cycle: Development -> Staging -> Production.'
      );
    }

    const sourceEnvironment =
      cleanEnv === 'production'
        ? envs.find((e) => e.name.toLowerCase() === 'staging') || envs[0]
        : envs.find((e) => e.name.toLowerCase() === 'development') || envs[0];
    if (!sourceEnvironment) {
      throw new BadRequestError('No valid source environment found for this project');
    }

    const currentVersionNum = existing.activeVersionNumber || 1;
    const prevTargetVersionNum = envVersions[cleanEnv] || 0;

    // 2. Field differences & semantic version calculation
    const { SchemaBlueprintVersion } = await import('../models/schema-blueprint-version.model');

    const prevTargetSnapshot =
      prevTargetVersionNum > 0
        ? await SchemaBlueprintVersion.findOne({
            projectId,
            blueprintId: existing._id,
            versionNumber: prevTargetVersionNum,
          }).exec()
        : null;

    const currentFields = existing.schemaDefinition?.fields || [];
    const prevFields = prevTargetSnapshot?.schemaDefinition?.fields || [];

    const currentFieldIds = new Set(currentFields.map((f: any) => f.id || f.key));
    const prevFieldIds = new Set(prevFields.map((f: any) => f.id || f.key));

    const addedFields = currentFields
      .filter((f: any) => !prevFieldIds.has(f.id || f.key))
      .map((f: any) => f.label || f.key);
    const removedFields = prevFields
      .filter((f: any) => !currentFieldIds.has(f.id || f.key))
      .map((f: any) => f.label || f.key);
    const modifiedFields: string[] = [];

    for (const cf of currentFields) {
      const fid = cf.id || cf.key;
      if (prevFieldIds.has(fid)) {
        const pf = prevFields.find((f: any) => (f.id || f.key) === fid);
        if (pf && JSON.stringify(cf) !== JSON.stringify(pf)) {
          modifiedFields.push(cf.label || cf.key);
        }
      }
    }

    // Semantic version determination
    let semanticVersion = `v1.0.0`;
    if (prevTargetSnapshot?.semanticVersion) {
      const parts = prevTargetSnapshot.semanticVersion.replace(/^v/, '').split('.').map(Number);
      if (removedFields.length > 0) {
        semanticVersion = `v${(parts[0] || 1) + 1}.0.0`; // Breaking change
      } else if (addedFields.length > 0) {
        semanticVersion = `v${parts[0] || 1}.${(parts[1] || 0) + 1}.0`; // Feature addition
      } else {
        semanticVersion = `v${parts[0] || 1}.${parts[1] || 0}.${(parts[2] || 0) + 1}`; // Patch
      }
    }

    // 3. Create version snapshot
    await SchemaBlueprintVersion.findOneAndUpdate(
      {
        projectId,
        blueprintId: existing._id,
        versionNumber: currentVersionNum,
      },
      {
        $set: {
          blueprintSlug: existing.slug,
          blueprintName: existing.name,
          semanticVersion,
          schemaDefinition: existing.schemaDefinition,
          summary: { addedFields, modifiedFields, removedFields },
          changelog: `Deployed to ${targetEnvironment.name}`,
          createdBy: userId,
        },
      },
      { upsert: true, new: true }
    );

    // 4. Create Release in Prisma (MySQL)
    const requiresApproval = Boolean(targetEnvironment.requiresApproval);
    const defaultApproverIds =
      requiresApproval && Array.isArray(targetEnvironment.defaultApproverIds)
        ? (targetEnvironment.defaultApproverIds as number[]).filter((uid) => uid !== userId)
        : [];

    const initialStatus =
      requiresApproval && defaultApproverIds.length > 0 ? 'PENDING_APPROVAL' : 'DEPLOYED';

    const { DEPLOYMENT_STAGES } = await import('./release.service');

    const release = await prisma.release.create({
      data: {
        projectId,
        sourceEnvironmentId: sourceEnvironment.id,
        targetEnvironmentId: targetEnvironment.id,
        version: semanticVersion,
        name: `Deploy ${existing.name} (${semanticVersion})`,
        description: `Automated blueprint release of '${existing.name}' to ${targetEnvironment.name}`,
        createdById: userId,
        status: initialStatus,
        deploymentStartedAt: initialStatus === 'DEPLOYED' ? new Date() : null,
        deploymentProgress: {
          isBlueprintRelease: true,
          blueprintId: existing._id.toString(),
          blueprintName: existing.name,
          versionNumber: currentVersionNum,
          semanticVersion,
          stages: DEPLOYMENT_STAGES.map((s, idx) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            status: initialStatus === 'DEPLOYED' ? 'COMPLETED' : idx === 0 ? 'PENDING' : 'PENDING',
            startedAt: initialStatus === 'DEPLOYED' ? new Date().toISOString() : null,
            completedAt: initialStatus === 'DEPLOYED' ? new Date().toISOString() : null,
          })),
        },
      },
    });

    if (defaultApproverIds.length > 0) {
      await prisma.releaseApproval.createMany({
        data: defaultApproverIds.map((approverId) => ({
          releaseId: release.id,
          approverId,
          status: 'PENDING',
        })),
        skipDuplicates: true,
      });
    }

    // 5. Update SchemaBlueprint
    const currentEnvs = Array.isArray(existing.environments) ? existing.environments : ['development'];
    const updatedEnvs = Array.from(new Set([...currentEnvs, cleanEnv]));
    const deployedAtMap: Record<string, Date> = (existing.deployedAt as any) || {};
    deployedAtMap[cleanEnv] = new Date();

    if (initialStatus === 'DEPLOYED') {
      envVersions[cleanEnv] = currentVersionNum;
    }

    const { SchemaBlueprint } = await import('../models/schema-blueprint.model');
    const updated = await SchemaBlueprint.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          environments: updatedEnvs,
          deployedAt: deployedAtMap,
          environmentVersions: envVersions,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new NotFoundError('Failed to deploy blueprint');
    }

    const message =
      initialStatus === 'PENDING_APPROVAL'
        ? `Release ${release.version} created and is pending approval for ${targetEnvironment.name}`
        : `Blueprint ${existing.name} deployed as ${semanticVersion} to ${targetEnvironment.name}`;

    return {
      schema: updated,
      release,
      message,
      requiresApproval: initialStatus === 'PENDING_APPROVAL',
    };
  },
};

