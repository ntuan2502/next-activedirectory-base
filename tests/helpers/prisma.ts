import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.$transaction.mockImplementation((callback) => {
    if (typeof callback === "function") {
      return callback(prismaMock);
    }
    return Promise.resolve(callback);
  });
});
