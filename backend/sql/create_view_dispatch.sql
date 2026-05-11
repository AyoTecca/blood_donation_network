CREATE OR REPLACE VIEW vw_dispatch_detail AS
SELECT 
    md.dispatch_id, 
    md.request_id, 
    md.unit_id, 
    md.status as dispatch_status, 
    TO_CHAR(md.dispatch_date, 'YYYY-MM-DD HH24:MI') as dispatch_time, 
    tr.urgency_level as urgency, 
    COALESCE(f.facility_name, 'Central Medical Center') as destination_facility
FROM match_dispatches md
LEFT JOIN transfusion_requests tr 
    ON md.request_id = tr.request_id
LEFT JOIN unit_transfers ut 
    ON md.unit_id = ut.unit_id
LEFT JOIN facilities f 
    ON ut.to_facility_id = f.facility_id;

EXIT;