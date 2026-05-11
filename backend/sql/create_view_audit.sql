CREATE OR REPLACE VIEW vw_audit_log AS
SELECT 
    h.history_id,
    h.request_id,
    h.operation_type,
    h.old_status,
    h.new_status,
    -- Используем CHANGED_AT из таблицы
    TO_CHAR(h.changed_at, 'YYYY-MM-DD HH24:MI:SS') as change_time,
    h.changed_by as user_id
FROM transfusion_request_history h
ORDER BY h.changed_at DESC;

EXIT;