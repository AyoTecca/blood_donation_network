CREATE OR REPLACE VIEW vw_audit_log AS
SELECT 
    h.history_id,
    h.request_id,
    h.old_status,
    h.new_status,
    TO_CHAR(h.change_timestamp, 'YYYY-MM-DD HH24:MI:SS') as change_time,
    h.changed_by as user_id
FROM transfusion_request_history h
ORDER BY h.change_timestamp DESC;

EXIT;