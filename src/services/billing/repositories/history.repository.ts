import { Prisma } from "@prisma/client";
import { BaseRepository } from "./base.repository";

export class HistoryRepository extends BaseRepository {

    create(data: Prisma.SubscriptionHistoryCreateInput) {
        return this.prisma.subscriptionHistory.create({
            data,
        });
    }

    findBySubscription(subscriptionId: number) {
        return this.prisma.subscriptionHistory.findMany({
            where: {
                subscriptionId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }

    findLatest(subscriptionId: number) {
        return this.prisma.subscriptionHistory.findFirst({
            where: {
                subscriptionId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
}