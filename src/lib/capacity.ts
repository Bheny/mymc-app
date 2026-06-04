import { prisma } from "@/lib/prisma";

export const CAPACITY = {
  // MegaChurch: no cap
  buscentre: { parentField: "mcId",         max: 4 },
  cell:      { parentField: "buscentreId",  max: 4 },
  shepherd:  { parentField: "cellId",       max: 2 },
  member:    { parentField: "shepherdId",   max: 5 },
} as const;

export type CapacityLevel = keyof typeof CAPACITY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelMap: Record<CapacityLevel, any> = {
  buscentre: prisma.buscentre,
  cell:      prisma.cell,
  shepherd:  prisma.shepherd,
  member:    prisma.member,
};

export async function checkCapacity(level: CapacityLevel, parentId: string) {
  const { parentField, max } = CAPACITY[level];
  const count: number = await modelMap[level].count({
    where: { [parentField]: parentId },
  });
  return {
    count,
    max,
    atCapacity:   count >= max,
    overCapacity: count > max,
  };
}

export async function logCapacityWarning({
  level,
  parentId,
  parentName,
  count,
  createdById,
}: {
  level:       CapacityLevel;
  parentId:    string;
  parentName:  string;
  count:       number;
  createdById: string;
}) {
  const { max } = CAPACITY[level];
  return prisma.capacityWarning.create({
    data: { level, parentId, parentName, currentCount: count, maxCount: max, createdById },
  });
}
