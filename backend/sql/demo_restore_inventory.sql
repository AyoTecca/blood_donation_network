-- Prepare a repeatable live demo after repeated process_blood_matches runs.
-- Does NOT re-seed CSV data:
--   1) moves non-expired Reserved units back to Available
--   2) creates a few Pending requests if the open queue is empty

DECLARE
    v_restored       NUMBER := 0;
    v_available      NUMBER := 0;
    v_open_requests  NUMBER := 0;
    v_created        NUMBER := 0;
BEGIN
    SELECT COUNT(*) INTO v_open_requests
      FROM transfusion_requests
     WHERE status IN ('Pending', 'Partially Fulfilled');

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

    IF v_open_requests = 0 THEN
        FOR p IN (
            SELECT patient_id
            FROM (
                SELECT p.patient_id
                FROM patients p
                JOIN blood_types bt ON bt.blood_type_id = p.blood_type_id
                WHERE bt.type_group = 'AB' AND bt.rh_factor = '+'
                ORDER BY p.patient_id
            )
            WHERE ROWNUM <= 5
        ) LOOP
            INSERT INTO transfusion_requests (
                request_id, patient_id, urgency_level,
                units_required, request_date, status
            )
            VALUES (
                (SELECT NVL(MAX(request_id), 0) + 1 FROM transfusion_requests),
                p.patient_id,
                LEAST(v_created + 1, 5),
                1,
                TRUNC(SYSDATE),
                'Pending'
            );

            v_created := v_created + 1;
        END LOOP;
    END IF;

    SELECT COUNT(*) INTO v_available
      FROM blood_units
     WHERE status = 'Available'
       AND expiry_date > TRUNC(SYSDATE);

    COMMIT;

    DBMS_OUTPUT.PUT_LINE('RESTORED=' || v_restored || ' AVAILABLE_NOW=' || v_available);
    DBMS_OUTPUT.PUT_LINE('PENDING_REQUESTS_CREATED=' || v_created);
END;
/
