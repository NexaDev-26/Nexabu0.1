/**
 * Report Delivery Service (stub)
 * Call your backend to schedule or send reports (email/WhatsApp/etc.).
 * Set VITE_REPORT_DELIVERY_URL to your backend endpoint.
 */

interface DeliveryPayload {
  reportType: string;
  format: 'pdf' | 'excel' | 'csv' | 'text';
  filters: Record<string, any>;
  timezoneOffset: number;
  schedule?: { type: 'immediate' | 'cron'; cron?: string };
  recipients?: { email?: string; whatsapp?: string }[];
}

const endpoint = import.meta.env.VITE_REPORT_DELIVERY_URL;

async function postJson<T>(path: string, payload: any): Promise<T> {
  if (!endpoint) {
    throw new Error('VITE_REPORT_DELIVERY_URL not configured');
  }
  const res = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function scheduleReportDelivery(payload: DeliveryPayload) {
  return postJson('/schedule', payload);
}

export async function sendReportNow(payload: DeliveryPayload) {
  return postJson('/send', payload);
}

