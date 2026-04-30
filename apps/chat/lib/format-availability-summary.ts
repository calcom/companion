import type { ScheduleAvailability } from "./calcom/types";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export function formatAvailabilitySummary(availability: ScheduleAvailability[]): string {
  if (availability.length === 0) return "No hours set";

  const rangeMap = new Map<string, string[]>();
  for (const entry of availability) {
    const range = `${entry.startTime}-${entry.endTime}`;
    for (const day of entry.days) {
      const existing = rangeMap.get(range) ?? [];
      existing.push(day);
      rangeMap.set(range, existing);
    }
  }

  return [...rangeMap.entries()]
    .map(([range, days]) => {
      const sorted = days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
      return `${compressDays(sorted)} ${range}`;
    })
    .join(", ");
}

function compressDays(sortedDays: string[]): string {
  if (sortedDays.length === 0) return "";
  if (sortedDays.length === 1) return DAY_SHORT[sortedDays[0]] ?? sortedDays[0];

  const runs: string[][] = [];
  let currentRun = [sortedDays[0]];

  for (let i = 1; i < sortedDays.length; i++) {
    const prevIdx = DAY_ORDER.indexOf(sortedDays[i - 1]);
    const currIdx = DAY_ORDER.indexOf(sortedDays[i]);
    if (currIdx === prevIdx + 1) {
      currentRun.push(sortedDays[i]);
    } else {
      runs.push(currentRun);
      currentRun = [sortedDays[i]];
    }
  }
  runs.push(currentRun);

  return runs
    .map((run) => {
      if (run.length <= 2) return run.map((day) => DAY_SHORT[day] ?? day).join(", ");
      return `${DAY_SHORT[run[0]] ?? run[0]}-${DAY_SHORT[run[run.length - 1]] ?? run[run.length - 1]}`;
    })
    .join(", ");
}
