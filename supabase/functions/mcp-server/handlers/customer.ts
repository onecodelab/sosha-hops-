import type { ToolContext } from "../types.ts";
import { getString } from "../utils.ts";

export async function updateCustomerProfile(context: ToolContext) {
    const phone = getString(context.params.phone);
    const fullName = getString(context.params.full_name);
    const email = getString(context.params.email);
    const preferences = context.params.preferences || {};

    let existingProfile = null;
    if (phone) {
        const { data } = await context.supabase
            .from('customer_profiles')
            .select('*')
            .eq('phone', phone)
            .eq('organization_id', context.organizationId)
            .maybeSingle();

        existingProfile = data;
    }

    if (existingProfile) {
        const mergedPreferences = {
            ...(existingProfile.preferences || {}),
            ...(preferences || {}),
        };

        const { data: updated, error: updateErr } = await context.supabase
            .from('customer_profiles')
            .update({
                full_name: fullName || existingProfile.full_name,
                email: email || existingProfile.email,
                preferences: mergedPreferences,
                visit_count: (existingProfile.visit_count || 0) + 1,
                last_visit: new Date().toISOString(),
            })
            .eq('id', existingProfile.id)
            .select()
            .single();

        if (updateErr) throw updateErr;
        return { profile: updated, action: 'updated' };
    }

    const { data: created, error: createErr } = await context.supabase
        .from('customer_profiles')
        .insert({
            organization_id: context.organizationId,
            branch_id: context.branchId || null,
            phone: phone || '',
            full_name: fullName || '',
            email: email || '',
            preferences: preferences || {},
            visit_count: 1,
            last_visit: new Date().toISOString(),
        })
        .select()
        .single();

    if (createErr) throw createErr;
    return { profile: created, action: 'created' };
}
