import { supabase } from '../utils/supabase';

export type DonorState = 
  | 'NOT_A_DONOR'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REQUEST_PENDING'
  | 'IN_QUEUE'
  | 'MATCHED'
  | 'COOLDOWN'
  | 'INELIGIBLE'
  | 'SUSPENDED';

export interface DonorStatus {
  state: DonorState;
  donation_cooldown_until: string | null;
  auto_reenable: boolean;
  pause_until: string | null;
  updated_at: string;
}

/**
 * Gets the current donor status for a given user.
 */
export async function getDonorStatus(userId: string): Promise<DonorStatus | null> {
  try {
    const { data, error } = await supabase
      .from('donor_statuses')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.warn('Error fetching donor status:', error?.message || 'Empty response');
      return null;
    }
    return data as DonorStatus;
  } catch (err) {
    console.error('getDonorStatus exception:', err);
    return null;
  }
}

/**
 * Helper to update state transitions and respect business validation rules.
 */
export async function transitionDonorState(
  userId: string, 
  nextState: DonorState, 
  extraFields: Partial<Omit<DonorStatus, 'state' | 'updated_at'>> = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await getDonorStatus(userId);
    if (!current) {
      return { success: false, error: 'User donor status profile not found.' };
    }

    const currentState = current.state;

    // Standard state transition validations as per Veno_Full_Specification.md Section 3.2
    if (currentState === nextState) {
      return { success: true };
    }

    // Rule: Donors cannot opt out / pause while in an active queue (IN_QUEUE / MATCHED)
    // unless they withdraw / decline through the matching module first.
    if ((currentState === 'IN_QUEUE' || currentState === 'MATCHED') && 
        (nextState === 'NOT_A_DONOR' || nextState === 'PAUSED')) {
      return { 
        success: false, 
        error: 'You have accepted a request. Please withdraw or complete the request before changing availability.' 
      };
    }

    // Rule: Cooldown override rules. If in COOLDOWN, cannot go ACTIVE directly.
    if (currentState === 'COOLDOWN' && nextState === 'ACTIVE') {
      const cooldownEnd = current.donation_cooldown_until ? new Date(current.donation_cooldown_until) : null;
      if (cooldownEnd && cooldownEnd > new Date()) {
        return { 
          success: false, 
          error: `You are in recovery cooldown until ${cooldownEnd.toLocaleDateString()}. Cooldown status cannot be waived manually.` 
        };
      }
    }

    // Rule: Suspended accounts can only be restored by admins.
    if (currentState === 'SUSPENDED') {
      return { 
        success: false, 
        error: 'Your account is suspended. Please contact administrator support.' 
      };
    }

    // Perform database status update
    const { error } = await supabase
      .from('donor_statuses')
      .update({
        state: nextState,
        updated_at: new Date().toISOString(),
        ...extraFields
      })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'An unexpected error occurred during state transition.' };
  }
}

/**
 * Manually pauses donor queries until a specified return date.
 */
export async function pauseDonations(userId: string, resumeDate: Date | null): Promise<{ success: boolean; error?: string }> {
  return transitionDonorState(userId, 'PAUSED', {
    pause_until: resumeDate ? resumeDate.toISOString() : null
  });
}

/**
 * Resumes donor availability, setting state back to ACTIVE.
 */
export async function resumeDonations(userId: string): Promise<{ success: boolean; error?: string }> {
  return transitionDonorState(userId, 'ACTIVE', {
    pause_until: null
  });
}

/**
 * Manually opts out from the donor database completely.
 */
export async function optOutDonations(userId: string): Promise<{ success: boolean; error?: string }> {
  return transitionDonorState(userId, 'NOT_A_DONOR', {
    pause_until: null
  });
}

/**
 * Puts donor into recovery cooldown for 120 days.
 */
export async function setCooldownState(userId: string, days = 120): Promise<{ success: boolean; error?: string }> {
  const cooldownUntil = new Date();
  cooldownUntil.setDate(cooldownUntil.getDate() + days);

  return transitionDonorState(userId, 'COOLDOWN', {
    donation_cooldown_until: cooldownUntil.toISOString()
  });
}

/**
 * Marks donor ineligible based on health checklist check errors.
 */
export async function setIneligibleState(userId: string): Promise<{ success: boolean; error?: string }> {
  return transitionDonorState(userId, 'INELIGIBLE');
}
