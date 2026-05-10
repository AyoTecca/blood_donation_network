CREATE OR REPLACE PACKAGE pkg_blood_operations AS
    -- Collection Types
    TYPE t_unit_ids IS TABLE OF NUMBER;
    TYPE t_request_rec IS RECORD (
        request_id   NUMBER,
        urgency      VARCHAR2(50),
        status       VARCHAR2(50),
        facility     VARCHAR2(100)
    );
    TYPE t_request_tab IS TABLE OF t_request_rec;

    -- Public Functions/Procedures
    FUNCTION check_compatibility(p_donor_type_id IN NUMBER, p_recipient_type_id IN NUMBER) RETURN VARCHAR2;
    
    FUNCTION calculate_distance_km(p_loc1_id IN NUMBER, p_loc2_id IN NUMBER) RETURN NUMBER;
    
    -- Updated to use a Collection instead of just a Ref Cursor
    FUNCTION get_request_list(p_user_role IN VARCHAR2, p_facility_id IN NUMBER) RETURN t_request_tab;

    -- Main logic
    PROCEDURE process_blood_matches;
END pkg_blood_operations;
/


CREATE OR REPLACE PACKAGE BODY pkg_blood_operations AS

    FUNCTION check_compatibility (p_donor_type_id IN NUMBER, p_recipient_type_id IN NUMBER) RETURN VARCHAR2 IS
        v_is_compatible NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_is_compatible FROM COMPATIBILITY_MATRIX 
        WHERE donor_blood_type_id = p_donor_type_id AND recipient_blood_type_id = p_recipient_type_id;
        RETURN CASE WHEN v_is_compatible > 0 THEN 'Y' ELSE 'N' END;
    EXCEPTION WHEN OTHERS THEN RETURN 'ERROR';
    END;

    FUNCTION calculate_distance_km (p_loc1_id IN NUMBER, p_loc2_id IN NUMBER) RETURN NUMBER IS
        v_lat1 NUMBER; v_lon1 NUMBER; v_lat2 NUMBER; v_lon2 NUMBER; v_radius NUMBER := 6371;
        v_dlat NUMBER; v_dlon NUMBER; v_a NUMBER; v_c NUMBER;
    BEGIN
        SELECT latitude, longitude INTO v_lat1, v_lon1 FROM GEOGRAPHIC_LOCATIONS WHERE location_id = p_loc1_id;
        SELECT latitude, longitude INTO v_lat2, v_lon2 FROM GEOGRAPHIC_LOCATIONS WHERE location_id = p_loc2_id;
        v_dlat := (v_lat2 - v_lat1) * ACOS(-1) / 180; v_dlon := (v_lon2 - v_lon1) * ACOS(-1) / 180;
        v_lat1 := v_lat1 * ACOS(-1) / 180; v_lat2 := v_lat2 * ACOS(-1) / 180;
        v_a := POWER(SIN(v_dlat/2), 2) + COS(v_lat1) * COS(v_lat2) * POWER(SIN(v_dlon/2), 2);
        v_c := 2 * ASIN(LEAST(1, SQRT(v_a)));
        RETURN ROUND(v_radius * v_c, 2);
    EXCEPTION WHEN NO_DATA_FOUND THEN RETURN -1;
    END;

    -- COLLECTION IMPLEMENTATION: Uses BULK COLLECT for better performance
    FUNCTION get_request_list (p_user_role IN VARCHAR2, p_facility_id IN NUMBER) RETURN t_request_tab IS
        v_results t_request_tab;
    BEGIN
        IF UPPER(p_user_role) = 'ADMIN' THEN
            SELECT r.request_id, r.urgency_level, r.status, f.facility_name 
            BULK COLLECT INTO v_results
            FROM TRANSFUSION_REQUESTS r JOIN PATIENTS p ON r.patient_id = p.patient_id 
            JOIN FACILITIES f ON p.current_facility_id = f.facility_id;
        ELSIF UPPER(p_user_role) = 'STAFF' THEN
            SELECT r.request_id, r.urgency_level, r.status, f.facility_name 
            BULK COLLECT INTO v_results
            FROM TRANSFUSION_REQUESTS r JOIN PATIENTS p ON r.patient_id = p.patient_id 
            JOIN FACILITIES f ON p.current_facility_id = f.facility_id 
            WHERE p.current_facility_id = p_facility_id;
        END IF;
        RETURN v_results;
    END;


    -- BULK PROCESSING: Using FORALL for mass updates
    PROCEDURE process_blood_matches IS
        v_units_to_reserve t_unit_ids := t_unit_ids(); 
        v_count NUMBER; -- Add this helper variable
    BEGIN
        FOR req_rec IN (SELECT r.request_id, r.units_required, p.blood_type_id 
                        FROM TRANSFUSION_REQUESTS r JOIN PATIENTS p ON r.patient_id = p.patient_id 
                        WHERE r.status IN ('Pending', 'Partially Fulfilled')) 
        LOOP
            SELECT unit_id BULK COLLECT INTO v_units_to_reserve
            FROM (
                SELECT u.unit_id FROM BLOOD_UNITS u 
                JOIN DONATION_EVENTS de ON u.donation_id = de.donation_id
                JOIN DONORS d ON de.donor_id = d.donor_id
                WHERE u.status = 'Available' AND u.expiry_date > SYSDATE 
                AND check_compatibility(d.blood_type_id, req_rec.blood_type_id) = 'Y'
                FETCH FIRST req_rec.units_required ROWS ONLY
            );

            v_count := v_units_to_reserve.COUNT; -- Store the count in a variable

            IF v_count > 0 THEN
                FORALL i IN 1..v_count
                    UPDATE BLOOD_UNITS SET status = 'Reserved' WHERE unit_id = v_units_to_reserve(i);
                
                -- Use the PL/SQL variable 'v_count' here instead of the collection attribute
                UPDATE TRANSFUSION_REQUESTS 
                SET status = CASE WHEN v_count = req_rec.units_required THEN 'Completed' ELSE 'Partially Fulfilled' END
                WHERE request_id = req_rec.request_id;
            END IF;
        END LOOP;
        COMMIT;
    END;

END pkg_blood_operations;
/

-- 1. Test the distance function
SELECT pkg_blood_operations.calculate_distance_km(1, 2) FROM DUAL;

-- 2. Test the collection-based list (running in a block)
DECLARE
    v_list pkg_blood_operations.t_request_tab;
BEGIN
    v_list := pkg_blood_operations.get_request_list('ADMIN', NULL);
    DBMS_OUTPUT.PUT_LINE('Total Requests found: ' || v_list.COUNT);
END;
/

-- 3. Run the matching process
BEGIN
    pkg_blood_operations.process_blood_matches;
END;
/


CREATE OR REPLACE PACKAGE pkg_blood_management AS
    -- Public Collection Type (needed for the function below)
    TYPE t_blood_type_list IS TABLE OF NUMBER;

    -- Procedure to bulk-expire units
    PROCEDURE expire_old_blood_units;

    -- Function to get compatible donor types using a collection
    FUNCTION get_compatible_donor_types(p_recipient_type_id IN NUMBER) 
    RETURN t_blood_type_list;

    -- We can also move your existing compatibility check here
    FUNCTION check_compatibility(p_donor_type_id IN NUMBER, p_recipient_type_id IN NUMBER) 
    RETURN VARCHAR2;
END pkg_blood_management;
/


CREATE OR REPLACE PACKAGE BODY pkg_blood_management AS

    -- 1. Implementation of the compatibility check
    FUNCTION check_compatibility(p_donor_type_id IN NUMBER, p_recipient_type_id IN NUMBER) 
    RETURN VARCHAR2 IS
        v_is_compatible NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_is_compatible 
        FROM COMPATIBILITY_MATRIX 
        WHERE donor_blood_type_id = p_donor_type_id 
          AND recipient_blood_type_id = p_recipient_type_id;
          
        RETURN CASE WHEN v_is_compatible > 0 THEN 'Y' ELSE 'N' END;
    EXCEPTION 
        WHEN OTHERS THEN RETURN 'ERROR';
    END check_compatibility;

    -- 2. Implementation of the collection-based search
    FUNCTION get_compatible_donor_types(p_recipient_type_id IN NUMBER) 
    RETURN t_blood_type_list IS
        v_list t_blood_type_list;
    BEGIN
        SELECT donor_blood_type_id
        BULK COLLECT INTO v_list
        FROM COMPATIBILITY_MATRIX
        WHERE recipient_blood_type_id = p_recipient_type_id;
        
        RETURN v_list;
    END get_compatible_donor_types;

    -- 3. Implementation of the bulk update
    PROCEDURE expire_old_blood_units IS
        TYPE t_unit_id_tab IS TABLE OF BLOOD_UNITS.unit_id%TYPE;
        v_ids t_unit_id_tab;
    BEGIN
        SELECT unit_id BULK COLLECT INTO v_ids
        FROM BLOOD_UNITS
        WHERE status = 'Available' AND expiry_date < SYSDATE;

        IF v_ids.COUNT > 0 THEN
            FORALL i IN 1..v_ids.COUNT
                UPDATE BLOOD_UNITS SET status = 'Expired' WHERE unit_id = v_ids(i);
        END IF;
        COMMIT;
    END expire_old_blood_units;

END pkg_blood_management;
/
