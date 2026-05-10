/** Client-side checks so invalid filter combos never hit the API. */

export function validateUrgencyRange(umin: string, umax: string): string | null {
  const minS = umin.trim();
  const maxS = umax.trim();
  if (!minS && !maxS) return null;
  const minV = minS === "" ? null : Number(minS);
  const maxV = maxS === "" ? null : Number(maxS);
  if (minV !== null && (Number.isNaN(minV) || minV < 1 || minV > 5)) {
    return "Urgency min must be a number from 1 to 5.";
  }
  if (maxV !== null && (Number.isNaN(maxV) || maxV < 1 || maxV > 5)) {
    return "Urgency max must be a number from 1 to 5.";
  }
  if (minV !== null && maxV !== null && minV > maxV) {
    return "Urgency min cannot be greater than urgency max.";
  }
  return null;
}

export function validateDateRange(from: string, to: string): string | null {
  const f = from.trim();
  const t = to.trim();
  if (!f || !t) return null;
  if (f > t) {
    return "From date cannot be after to date.";
  }
  return null;
}
