CREATE OR REPLACE VIEW vw_dispatch_detail AS
SELECT
    md.dispatch_id,
    md.request_id,
    md.unit_id,
    md.status AS dispatch_status,
    TO_CHAR(md.dispatch_date, 'YYYY-MM-DD HH24:MI') AS dispatch_time,
    md.distance_km,
    tr.urgency_level AS urgency,
    COALESCE(f.facility_name, 'Unknown facility') AS destination_facility
FROM match_dispatches md
LEFT JOIN transfusion_requests tr ON md.request_id = tr.request_id
LEFT JOIN patients p ON p.patient_id = tr.patient_id
LEFT JOIN facilities f ON f.facility_id = p.current_facility_id
/
