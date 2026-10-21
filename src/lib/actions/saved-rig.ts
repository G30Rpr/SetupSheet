"use server";

import { isRigBrakeType, isRigInputDevice } from "@/lib/rig-axes";
import { createClient } from "@/lib/supabase/server";

export type SaveRigProfileResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Saves (or replaces) the signed-in user's rig axes -- the account-level
 * "my rig" behind Best for my rig and the Matches your rig chip (0040).
 * RLS keeps the write owner-only; a signed-out call is refused here rather
 * than relying on the policy error alone, so the client shows plain copy.
 */
export async function saveRigProfile(
  inputDevice: string,
  brakeType: string | null
): Promise<SaveRigProfileResult> {
  if (!isRigInputDevice(inputDevice)) {
    return { ok: false, error: "Pick how you steer to save your rig." };
  }
  if (brakeType !== null && !isRigBrakeType(brakeType)) {
    return { ok: false, error: "Pick a valid brake setup to save your rig." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Sign in to save your rig to your account." };
    }

    const { error } = await supabase.from("saved_rig_profiles").upsert(
      {
        user_id: user.id,
        input_device: inputDevice,
        brake_type: brakeType,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      return { ok: false, error: "Couldn't save your rig. Try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save your rig. Try again." };
  }
}
