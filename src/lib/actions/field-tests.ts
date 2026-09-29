"use server";

import { revalidatePath } from "next/cache";

import { getActionError } from "@/lib/actions/action-errors";
import {
  parseCreateFieldTestReportInput,
  parseSetFieldTestAttributionInput,
} from "@/lib/field-tests";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const FIELD_TEST_CREATE_MESSAGES = [
  "Garage session not found",
  "Garage session was not started from this setup",
  "Log at least one lap before submitting a field test",
  "Record at least one better run-plan result before submitting a field test",
] as const;

function getCreateFieldTestError(error: unknown): string {
  const candidate = error as { code?: unknown } | null;
  if (candidate?.code === "23505") {
    return "You already submitted a field test for this setup today (UTC).";
  }
  return getActionError(error, "Couldn't submit that field test right now.", FIELD_TEST_CREATE_MESSAGES);
}

export async function createFieldTestReport(
  input: unknown
): Promise<{ reportId: string | null; error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { reportId: null, error: "Log in to submit a field test." };

  const parsed = parseCreateFieldTestReportInput(input);
  if (!parsed.value) return { reportId: null, error: parsed.error ?? "Field-test details are invalid." };

  const { value } = parsed;
  const { data, error } = await supabase.rpc("create_field_test_report", {
    p_garage_session_id: value.garageSessionId,
    p_setup_id: value.setupId,
    p_note: value.note,
  });

  if (error || typeof data !== "string") {
    logger.error("createFieldTestReport: atomic report creation failed", error);
    return { reportId: null, error: getCreateFieldTestError(error) };
  }

  revalidatePath("/garage");
  revalidatePath(`/setups/${encodeURIComponent(value.setupId)}`);
  revalidatePath("/setups");
  revalidatePath("/");
  return { reportId: data, error: null };
}

export async function setFieldTestReportAttribution(
  input: unknown
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { error: "Log in to change field-test attribution." };

  const parsed = parseSetFieldTestAttributionInput(input);
  if (!parsed.value) return { error: parsed.error ?? "Attribution preference is invalid." };

  const { data, error } = await supabase.rpc("set_field_test_report_attribution", {
    p_report_id: parsed.value.reportId,
    p_show_name: parsed.value.showName,
  });
  if (error || typeof data !== "string") {
    logger.error("setFieldTestReportAttribution: update failed", error ?? new Error("RPC returned no setup ID"));
    return {
      error: getActionError(error, "Couldn't update that report's attribution right now.", [
        "Field-test report not found",
      ]),
    };
  }

  revalidatePath(`/setups/${encodeURIComponent(data)}`);
  revalidatePath("/setups");
  return { error: null };
}
