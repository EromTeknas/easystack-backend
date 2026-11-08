import { prisma } from '../db/prisma';
import { Prisma, ProjectAsset } from '@prisma/client';

export interface ListProjectAssetsOptions {
  fileType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedProjectAssets {
  assets: ProjectAsset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ProjectAssetRepository = {
  async findByProjectId(
    projectId: number,
    options: ListProjectAssetsOptions = {}
  ): Promise<PaginatedProjectAssets> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 30));
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectAssetWhereInput = {
      projectId,
      removedAt: null,
    };

    if (options.fileType && options.fileType !== 'all') {
      where.fileType = options.fileType.toLowerCase().trim();
    }

    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      where.OR = [
        { name: { contains: q } },
        { altText: { contains: q } },
      ];
    }

    const [assets, total] = await Promise.all([
      prisma.projectAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.projectAsset.count({ where }),
    ]);

    return {
      assets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async findById(id: string): Promise<ProjectAsset | null> {
    return prisma.projectAsset.findFirst({
      where: {
        id,
        removedAt: null,
      },
    });
  },

  async findByStorageAssetId(storageAssetId: string): Promise<ProjectAsset | null> {
    return prisma.projectAsset.findFirst({
      where: {
        storageAssetId,
        removedAt: null,
      },
    });
  },

  async create(data: {
    projectId: number;
    storageAssetId: string;
    name: string;
    altText?: string | null;
    caption?: string | null;
    fileType: string;
    mimeType: string;
    sizeBytes: bigint | number;
    publicUrl: string;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
    createdById: number;
  }): Promise<ProjectAsset> {
    return prisma.projectAsset.create({
      data: {
        projectId: data.projectId,
        storageAssetId: data.storageAssetId,
        name: data.name,
        altText: data.altText ?? null,
        caption: data.caption ?? null,
        fileType: data.fileType,
        mimeType: data.mimeType,
        sizeBytes: BigInt(data.sizeBytes),
        publicUrl: data.publicUrl,
        width: data.width ?? null,
        height: data.height ?? null,
        duration: data.duration ?? null,
        createdById: data.createdById,
      },
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      altText?: string | null;
      caption?: string | null;
    }
  ): Promise<ProjectAsset> {
    return prisma.projectAsset.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.altText !== undefined ? { altText: data.altText } : {}),
        ...(data.caption !== undefined ? { caption: data.caption } : {}),
      },
    });
  },

  async softDelete(id: string): Promise<ProjectAsset> {
    return prisma.projectAsset.update({
      where: { id },
      data: {
        removedAt: new Date(),
      },
    });
  },

  async getTotalStorageBytes(projectId: number): Promise<bigint> {
    const aggregate = await prisma.projectAsset.aggregate({
      where: {
        projectId,
        removedAt: null,
      },
      _sum: {
        sizeBytes: true,
      },
    });

    return aggregate._sum.sizeBytes ?? BigInt(0);
  },
};
