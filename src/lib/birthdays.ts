/**
 * Shared utility — compute upcoming birthdays from a list of members.
 * Handles year rollover (e.g. querying in late December catches January birthdays).
 */

export type BirthdayEntry = {
  id:          string;
  firstName:   string;
  lastName:    string;
  daysUntil:   number;            // 0 = today, 1 = tomorrow, etc.
  dateLabel:   string;            // e.g. "15 Jun"
  monthDay:    string;            // sortable "06-15"
  turningAge:  number | null;     // age they'll be turning on the upcoming birthday
  phone:       string | null;
  cellName:    string | null;
};

export function upcomingBirthdays(
  members: Array<{
    id:          string;
    firstName:   string;
    lastName:    string;
    dateOfBirth: Date | string | null;
    phone?:      string | null;
    cell?:       { name: string } | null;
  }>,
  daysAhead = 30
): BirthdayEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return members
    .filter((m) => m.dateOfBirth)
    .map((m) => {
      const dob = new Date(m.dateOfBirth!);

      // This year's birthday
      const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      // If already passed, next year's
      const next = thisYear < today
        ? new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate())
        : thisYear;

      const daysUntil  = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      const dateLabel  = dob.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const monthDay   = `${String(dob.getMonth() + 1).padStart(2, "0")}-${String(dob.getDate()).padStart(2, "0")}`;
      const turningAge = next.getFullYear() - dob.getFullYear();

      return {
        id: m.id, firstName: m.firstName, lastName: m.lastName,
        daysUntil, dateLabel, monthDay, turningAge,
        phone:    m.phone ?? null,
        cellName: m.cell?.name ?? null,
      };
    })
    .filter((m) => m.daysUntil <= daysAhead)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
