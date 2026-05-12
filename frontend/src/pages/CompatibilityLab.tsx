import  { useEffect, useState } from "react";
// ВАЖНО: Импортируем твой кастомный fetcher. 
// Убедись, что путь '../api' правильный (если страница в src/pages/, то путь верный)
import { apiFetch } from '../api'; 
import '../style.css'; 

// Статичные группы крови
const STATIC_BLOOD_TYPES = [
  { id: 1, type: "O-" },
  { id: 4, type: "O+" },
  { id: 7, type: "A-" },
  { id: 6, type: "A+" },
  { id: 2, type: "B-" },
  { id: 5, type: "B+" },
  { id: 11, type: "AB-" },
  { id: 3, type: "AB+" }
];

export function CompatibilityLab() {
  const [donorId, setDonorId] = useState<string>("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [isCompatible, setIsCompatible] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!donorId || !recipientId) {
      setIsCompatible(null);
      return;
    }

    setIsLoading(true);
    
    // ВАЖНО: Убедись, что параметры (donor_id) совпадают с тем, что ждет FastAPI!
    apiFetch(`/api/compatibility/check?donor_type_id=${donorId}&recipient_type_id=${recipientId}`)
      .then((data: any) => {
        // Выводим ответ сервера в консоль браузера, чтобы точно знать, что там!
        console.log("Backend response:", data);

        // Если прилетела ошибка валидации (422) или другая
        if (data.detail) {
          console.error("API Error:", data.detail);
          setIsCompatible(false);
          setIsLoading(false);
          return;
        }

        // Ловим ВСЕ возможные варианты ключей, которые мог использовать бэкенд
        const result = data.compatible_flag ?? data.compatible ?? data.is_compatible ?? data.result ?? false;

        // Обрабатываем и boolean (true/false), и строки ('Y'/'N') от Oracle
        if (result === 'Y' || result === true) {
          setIsCompatible(true);
        } else {
          setIsCompatible(false);
        }
        
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Fetch failed", err);
        setIsLoading(false);
      });
  }, [donorId, recipientId]);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Compatibility Lab 🔬</h1>
        <span className="status-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>
          PL/SQL Powered
        </span>
      </div>
      <p style={{ color: '#64748b', marginBottom: '30px' }}>
        Interactive blood matching calculator. Select a donor and recipient to verify compatibility against the Oracle database rules.
      </p>

      <div className="dashboard-card" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🩸</div>
            <h3 style={{ margin: '0 0 15px 0', color: '#dc2626' }}>Donor</h3>
            <select 
              aria-label="Donor Blood Type"
              title="Donor Blood Type"
              value={donorId} 
              onChange={(e) => setDonorId(e.target.value)}
              style={{ width: '100%', padding: '12px', fontSize: '18px', borderRadius: '8px', border: '2px solid #e2e8f0', cursor: 'pointer' }}
            >
              <option value="">Select Type...</option>
              {STATIC_BLOOD_TYPES.map((bt) => (
                <option key={`d-${bt.id}`} value={bt.id}>
                  {bt.type}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '32px', color: '#cbd5e1', padding: '0 20px' }}>➔</div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏥</div>
            <h3 style={{ margin: '0 0 15px 0', color: '#2563eb' }}>Recipient</h3>
            <select 
              aria-label="Recipient Blood Type"
              title="Recipient Blood Type"
              value={recipientId} 
              onChange={(e) => setRecipientId(e.target.value)}
              style={{ width: '100%', padding: '12px', fontSize: '18px', borderRadius: '8px', border: '2px solid #e2e8f0', cursor: 'pointer' }}
            >
              <option value="">Select Type...</option>
              {STATIC_BLOOD_TYPES.map((bt) => (
                <option key={`r-${bt.id}`} value={bt.id}>
                  {bt.type}
                </option>
              ))}
            </select>
          </div>

        </div>

        <div style={{ marginTop: '40px', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!donorId || !recipientId ? (
            <div style={{ color: '#94a3b8', fontSize: '16px' }}>
              Select both types to see the result
            </div>
          ) : isLoading ? (
            <div style={{ color: '#64748b', fontSize: '18px' }}>Checking Oracle Database... ⏳</div>
          ) : isCompatible ? (
            <div style={{ 
              width: '100%', padding: '20px', borderRadius: '12px', 
              backgroundColor: '#dcfce7', border: '2px solid #86efac',
              color: '#166534', fontSize: '24px', fontWeight: 'bold'
            }}>
              ✅ Compatible Match
            </div>
          ) : (
            <div style={{ 
              width: '100%', padding: '20px', borderRadius: '12px', 
              backgroundColor: '#fee2e2', border: '2px solid #fca5a5',
              color: '#991b1b', fontSize: '24px', fontWeight: 'bold'
            }}>
              ❌ Incompatible
            </div>
          )}
        </div>

      </div>
    </div>
  );
}