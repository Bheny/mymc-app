import { prisma } from "@/lib/prisma";
import {
  CAPACITY, CAPACITY_LEVELS, defaultCapacityLimits, isCapacityLevel,
  type CapacityLevel, type CapacityLimit, type CapacityLimits,
} from "@/lib/capacity-defaults";

export { CAPACITY, CAPACITY_LEVELS, isCapacityLevel };
export type { CapacityLevel, CapacityLimit, CapacityLimits };

// Defaults from capacity-defaults, overridden by any rows saved in Settings
export async function getCapacityLimits(): Promise<CapacityLimits> {
  const limits = defaultCapacityLimits();

  try {
    const rows = await prisma.capacityLimit.findMany();
    for (const r of rows) {
      if (isCapacityLevel(r.level)) limits[r.level] = { max: r.max, enforce: r.enforce };
    }
  } catch (err) {
    // Table not yet created (schema not pushed) — fall back to defaults
    console.warn("[capacity] using default limits:", (err as Error).message);
  }
  return limits;
}

export async function getCapacityLimit(level: CapacityLevel): Promise<CapacityLimit> {
  return (await getCapacityLimits())[level];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelMap: Record<CapacityLevel, any> = {
  buscentre: prisma.buscentre,
  cell:      prisma.cell,
  shepherd:  prisma.shepherd,
  member:    prisma.member,
};

export async function checkCapacity(level: CapacityLevel, parentId: string) {
  const { parentField } = CAPACITY[level];
  const [{ max, enforce }, count] = await Promise.all([
    getCapacityLimit(level),
    modelMap[level].count({ where: { [parentField]: parentId } }) as Promise<number>,
  ]);
  return {
    count,
    max,
    enforce,
    atCapacity:   count >= max,
    overCapacity: count > max,
    // Adding one more is refused only when the limit is enforced
    blocked:      enforce && count >= max,
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
  const { max } = await getCapacityLimit(level);
  return prisma.capacityWarning.create({
    data: { level, parentId, parentName, currentCount: count, maxCount: max, createdById },
  });
}
