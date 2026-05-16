-- Seed transfusion_request_history for rows loaded before trg_transfusion_requests_history existed.
-- One INSERT audit row per existing request (idempotent).

INSERT INTO transfusion_request_history (
    request_id,
    operation_type,
    old_status,
    new_status,
    old_units_required,
    new_units_required,
    changed_at,
    changed_by,
    change_note
)
SELECT
    r.request_id,
    'INSERT',
    NULL,
    r.status,
    NULL,
    r.units_required,
    NVL(r.request_date, SYSDATE),
    'SYSTEM',
    'Backfilled from seed transfusion_requests'
FROM transfusion_requests r
WHERE NOT EXISTS (
    SELECT 1
    FROM transfusion_request_history h
    WHERE h.request_id = r.request_id
      AND h.operation_type = 'INSERT'
      AND h.change_note = 'Backfilled from seed transfusion_requests'
)
/
