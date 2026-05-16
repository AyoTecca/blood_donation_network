CREATE OR REPLACE VIEW vw_unit_lineage AS
SELECT
    u.unit_id,
    u.status AS unit_status,
    TO_CHAR(u.expiry_date, 'YYYY-MM-DD') AS expiry_date,
    de.donation_id,
    TO_CHAR(de.donation_date, 'YYYY-MM-DD') AS donation_date,
    d.donor_id,
    d.first_name || ' ' || d.last_name AS donor_name,
    bt.type_group || bt.rh_factor AS blood_type
FROM blood_units u
JOIN donation_events de ON u.donation_id = de.donation_id
JOIN donors d ON de.donor_id = d.donor_id
JOIN blood_types bt ON d.blood_type_id = bt.blood_type_id
/
