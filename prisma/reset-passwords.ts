/**
 * DEV ONLY — Lists all users and resets their passwords to a known value.
 * Run: npx tsx prisma/reset-passwords.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const NEW_PASSWORD = "DevPass#1234";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, mustChangePassword: true, role: true },
    orderBy: { name: "asc" },
  });

  console.log("\n── All system users ────────────────────────────");
  users.forEach((u) => {
    const role = u.role?.role ?? "no role";
    console.log(`  ${u.email.padEnd(35)} ${role}`);
  });
  console.log("────────────────────────────────────────────────");

  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  await prisma.user.updateMany({
    data: { password: hash, mustChangePassword: false },
  });

  console.log(`\n✓ All ${users.length} user passwords reset to: ${NEW_PASSWORD}`);
  console.log("  (mustChangePassword set to false — direct access)\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
