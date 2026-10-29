// Scores a live category against its reviewed acceptable set (test plan Q4).
// Only a hazard (no acceptable "activity") labelled activity fails a case;
// other misses are reported without failing.
export function scoreCategory(category: string, acceptable?: string[]) {
  const miss = !!acceptable && !acceptable.includes(category);
  return {
    miss,
    hazardAsActivity:
      miss && category === "activity" && !acceptable!.includes("activity"),
  };
}
