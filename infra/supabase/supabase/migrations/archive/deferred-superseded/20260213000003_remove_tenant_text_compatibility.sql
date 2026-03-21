-- Apply after compatibility window ends.
-- Removes TEXT overloads/casts now that UUID tenant IDs are universal.

DROP FUNCTION IF EXISTS security.user_has_tenant_access(text);
DROP FUNCTION IF EXISTS security.is_current_user_tenant_member(text);
DROP FUNCTION IF EXISTS app.is_active_member(text, uuid);

DROP FUNCTION IF EXISTS security.try_parse_uuid(text);
