CREATE OR REPLACE VIEW vw_compat_pairs_readable AS
SELECT 
    cm.donor_blood_type_id,
    dt.type_group || dt.rh_factor AS donor_blood_type,
    cm.recipient_blood_type_id,
    rt.type_group || rt.rh_factor AS recipient_blood_type
FROM compatibility_matrix cm
JOIN blood_types dt ON cm.donor_blood_type_id = dt.blood_type_id
JOIN blood_types rt ON cm.recipient_blood_type_id = rt.blood_type_id;