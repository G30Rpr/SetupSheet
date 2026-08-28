"use server";

import { revalidatePath } from "next/cache";

import { getActionError } from "@/lib/actions/action-errors";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export type ReportTargetType = "setup" | "comment" | "profile";
export type ReportReason = "spam" | "unsafe_file" | "harassment" | "copyright" | "other";

const reasons: ReportReason[] = ["spam", "unsafe_file", "harassment", "copyright", "other"];

export interface ContentReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string;
}

function validateReport(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "Invalid report.";
  }

  const fields = input as Record<string, unknown>;
  if (
    (fields.targetType !== "setup" && fields.targetType !== "comment" && fields.targetType !== "profile") ||
    !isUuid(fields.targetId) ||
    (typeof fields.reason !== "string" || !reasons.includes(fields.reason as ReportReason)) ||
    typeof fields.details !== "string"
  ) {
    return "Invalid report.";
  }

  if (fields.details.length > 2000) return "Report details are too long — max 2000 characters.";
  return null;
}

/** Submits a private moderation report for operator review. */
export async function submitContentReport(
  input: ContentReportInput
): Promise<{ error: string | null }> {
  const validationError = validateReport(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { error: "You need to be logged in to submit a report." };

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details.trim(),
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have an active report for this content." };
    }
    logger.error("submitContentReport: insert failed", error);
    return { error: getActionError(error, "Couldn't submit the report right now.") };
  }

  revalidatePath("/report");
  return { error: null };
}
