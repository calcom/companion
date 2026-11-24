/**
 * Overlap layout — pure column geometry for a day: cluster overlapping intervals
 * (half-open), then greedy first-fit columns; `cols` is cluster-wide, not the local clique.
 */

import { bucketByLane } from "./lane";

/**
 * @deprecated use `bucketByLane`. Kept so existing call sites and any host code
 * reading the old name keep working for one release.
 */
export const bucketByDay = <T extends { laneIndex: number }>(
  events: readonly T[],
  dayCount: number,
): T[][] => bucketByLane(events, dayCount);

export interface OverlapLayout {
  col: number;
  cols: number;
}

export interface OverlapInput {
  id: string;
  startMin: number;
  endMin: number;
}

export function layoutDay(dayEvents: readonly OverlapInput[]): Map<string, OverlapLayout> {
  const out = new Map<string, OverlapLayout>();
  const sorted = [...dayEvents].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  let cluster: OverlapInput[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const cols = new Map<string, number>();
    for (const e of cluster) {
      let col = colEnds.findIndex((end) => end <= e.startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(e.endMin);
      } else {
        colEnds[col] = e.endMin;
      }
      cols.set(e.id, col);
    }
    for (const e of cluster) {
      out.set(e.id, { col: cols.get(e.id)!, cols: colEnds.length });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const e of sorted) {
    if (cluster.length && e.startMin >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  flush();
  return out;
}
