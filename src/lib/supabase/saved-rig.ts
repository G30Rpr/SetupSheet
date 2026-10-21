import { isRigBrakeType, isRigInputDevice, type RigAxes } from "@/lib/rig-axes";
import { createClient } from "@/lib/supabase/server";

export interface ViewerRig {
  /** Whether the viewer is signed in (enables account-level saving). */
  signedIn: boolean;
  /** The account-saved rig axes, or null when signed out / none saved. */
  axes: RigAxes | null;
}

/**
 * The signed-in viewer's saved rig (saved_rig_profiles, 0040). Owner-only
 * RLS means this can only ever return the caller's own row; anonymous
 * callers get { signedIn: false, axes: null } and the browse page falls
 * back to the device-local memory (readMyRigAxes). Never throws -- a rig
 * read failing must not take /setups down.
 */
export async function getViewerRig(): Promise<ViewerRig> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { signedIn: false, axes: null };

    const { data, error } = await supabase
      .from("saved_rig_profiles")
      .select("input_device, brake_type")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) return { signedIn: true, axes: null };
    if (!isRigInputDevice(data.input_device)) return { signedIn: true, axes: null };

    return {
      signedIn: true,
      axes: {
        inputDevice: data.input_device,
        brakeType: isRigBrakeType(data.brake_type) ? data.brake_type : null,
      },
    };
  } catch {
    return { signedIn: false, axes: null };
  }
}
