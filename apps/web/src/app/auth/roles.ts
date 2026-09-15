/**
 * Roles that can plan/manage Actions — admins and managers, not reps. Shared
 * between the route guard (RequireRole) and the sidebar's nav filter so the
 * two never drift apart.
 */
export const MANAGER_ROLES = ["owner", "admin", "account_manager"];
