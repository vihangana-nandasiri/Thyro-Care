/** TSH history is not stored in this data-minimised system. */
export const mockTshHistory: Array<{
  date: string;
  value: string;
  status: "optimal" | "normal" | "high";
}> = [];