import { supabase } from '../supabase';

type OrderLike = {
  waiter_id?: string | null;
  closed_by_id?: string | null;
};

type ProfileLite = {
  id: string;
  full_name?: string | null;
  role?: string | null;
  email?: string | null;
};

export async function enrichOrdersWithProfiles<T extends OrderLike>(orders: T[]): Promise<Array<T & {
  waiter?: ProfileLite | null;
  closed_by_user?: ProfileLite | null;
}>> {
  if (!orders.length) return orders as Array<T & { waiter?: ProfileLite | null; closed_by_user?: ProfileLite | null }>;

  const profileIds = Array.from(
    new Set(
      orders
        .flatMap(order => [order.waiter_id, order.closed_by_id])
        .filter((id): id is string => Boolean(id))
    )
  );

  if (!profileIds.length) {
    return orders.map(order => ({
      ...order,
      waiter: null,
      closed_by_user: null
    }));
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, email')
    .in('id', profileIds);

  if (error) throw error;

  const profileMap = new Map<string, ProfileLite>((profiles || []).map(profile => [profile.id, profile as ProfileLite]));

  return orders.map(order => ({
    ...order,
    waiter: order.waiter_id ? profileMap.get(order.waiter_id) ?? null : null,
    closed_by_user: order.closed_by_id ? profileMap.get(order.closed_by_id) ?? null : null
  }));
}
