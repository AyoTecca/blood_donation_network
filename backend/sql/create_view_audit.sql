CREATE OR REPLACE VIEW vw_audit_log AS
SELECT
    h.history_id,
    h.request_id,
    h.operation_type,
    h.old_status,
    h.new_status,
    TO_CHAR(h.changed_at, 'YYYY-MM-DD HH24:MI:SS') AS change_time,
    h.changed_by AS user_id,
    h.change_note
FROM transfusion_request_history h
/
