import { createStorageModule } from "./infrastructure/createStorageModule";
import { prisma } from "../../db/prisma";

export const storageService = createStorageModule(prisma);
