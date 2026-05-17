-- Restore inventory for live demos after repeated process_blood_matches runs.
-- Does NOT re-seed CSV data: moves non-expired Reserved units back to Available.
-- Safe to run multiple times (idempotent up to the unit cap).

DECLARE
    v_restored   NUMBER := 0;
    v_available  NUMBER := 0;
BEGIN
    UPDATE blood_units u
       SET u.status = 'Available'
     WHERE u.unit_id IN (
           SELECT unit_id
             FROM (
                   SELECT bu.unit_id
                     FROM blood_units bu
                    WHERE bu.status = 'Reserved'
                      AND bu.expiry_date > TRUNC(SYSDATE)
                    ORDER BY bu.unit_id
                    FETCH FIRST 300 ROWS ONLY
                  )
           );

    v_restored := SQL%ROWCOUNT;

    SELECT COUNT(*) INTO v_available
      FROM blood_units
     WHERE status = 'Available'
       AND expiry_date > TRUNC(SYSDATE);

    COMMIT;

    DBMS_OUTPUT.PUT_LINE('RESTORED=' || v_restored || ' AVAILABLE_NOW=' || v_available);
END;
/
