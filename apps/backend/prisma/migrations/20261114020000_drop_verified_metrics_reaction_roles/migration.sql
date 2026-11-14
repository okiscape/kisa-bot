-- Remove unused server settings: verified role, collect metrics, reaction roles.
ALTER TABLE "server_settings" DROP COLUMN IF EXISTS "verified_role";
ALTER TABLE "server_settings" DROP COLUMN IF EXISTS "collect_metrics";
ALTER TABLE "server_settings" DROP COLUMN IF EXISTS "reaction_roles";
