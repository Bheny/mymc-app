import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── Branch ────────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where:  { id: "seed-branch-1" },
    update: {},
    create: { id: "seed-branch-1", name: "Main Branch" },
  });
  console.log(`✓ Branch: ${branch.name}`);

  // ── MegaChurch ────────────────────────────────────────────────────
  const mc = await prisma.megaChurch.upsert({
    where:  { id: "seed-mc-1" },
    update: {},
    create: { id: "seed-mc-1", branchId: branch.id, name: "DUNAMIS MC" },
  });
  console.log(`✓ MegaChurch: ${mc.name}`);

  // ── Admin user ────────────────────────────────────────────────────
  const password = await bcrypt.hash("Admin@1234", 12);

  const admin = await prisma.user.upsert({
    where:  { email: "admin@mymc.app" },
    update: {},
    create: {
      email:              "admin@mymc.app",
      name:               "Admin",
      password,
      mustChangePassword: false,
      isActive:           true,
      activatedAt:        new Date(),
    },
  });
  console.log(`✓ User: ${admin.email}`);

  await prisma.userRole.upsert({
    where:  { userId: admin.id },
    update: {},
    create: { userId: admin.id, role: "admin", branchId: branch.id },
  });
  console.log(`✓ Role: admin → ${branch.name}`);

  console.log("\n── Login credentials ──────────────────");
  console.log("  Email:    admin@mymc.app");
  console.log("  Password: Admin@1234");
  console.log("────────────────────────────────────────");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
