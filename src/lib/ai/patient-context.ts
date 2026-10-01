import { listMedications, generateScheduleWithStatus } from "@/lib/services/medications";
import { listSymptoms } from "@/lib/services/symptoms";
import { dictionaries, type Lang } from "@/lib/i18n/config";

/**
 * Grounding block for "what's on file for me" questions (next dose, recent
 * symptoms) — factual data already entered by the doctor or
 * the patient themselves, never an AI judgment call.
 */
export async function getPatientContext(
  patientId: string,
  language: Lang,
): Promise<{ text: string; hasData: boolean }> {
  const [meds, symptoms] = await Promise.all([
    listMedications(patientId),
    listSymptoms(patientId),
  ]);

  const now = new Date();
  // Looks slightly into the past too, so a dose due minutes ago but not yet
  // logged still counts as "next" rather than being skipped over.
  const lookStart = new Date(now.getTime() - 6 * 3600_000);
  const lookEnd = new Date(now.getTime() + 7 * 24 * 3600_000);
  const medLines = await Promise.all(
    meds.map(async (m) => {
      const schedule = await generateScheduleWithStatus(m, lookStart, lookEnd);
      // The next dose is the next UNLOGGED occurrence, not just the next
      // chronological one — otherwise an already-taken dose still shows as
      // "next".
      const nextUntaken = schedule.find((occ) => occ.status === null);
      const nextText = nextUntaken
        ? `, next dose ${nextUntaken.scheduledFor.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
        : "";
      return `- ${m.name}: ${m.dose} ${m.unit}, ${m.frequency}${nextText}${m.instructions ? ` (${m.instructions})` : ""}`;
    }),
  );

  const symptomLines = symptoms.slice(0, 3).map(
    (s) => `- ${s.symptomType} (${s.severity}), logged ${s.createdAt.toLocaleDateString()}`,
  );

  const dict = dictionaries[language];
  const hasData = medLines.length > 0 || symptomLines.length > 0;

  const text = [
    `Medications on file (from the doctor's plan):\n${medLines.length ? medLines.join("\n") : "None on file."}`,
    `Recently logged symptoms:\n${symptomLines.length ? symptomLines.join("\n") : "None logged recently."}`,
    `Emergency guidance (only repeat this if asked what to do in a medical emergency):\n${dict["emergency.title"]}. ${dict["emergency.body"]}`,
  ].join("\n\n");

  return { text, hasData };
}
