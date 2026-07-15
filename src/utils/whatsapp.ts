export function sendWhatsApp(phone: string, message: string) {
  const cleaned = phone.replace(/\D/g, '');
  const url = `https://wa.me/90${cleaned}?text=${encodeURIComponent(message)}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
}

export function getWhatsAppUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return `https://wa.me/90${cleaned}?text=${encodeURIComponent(message)}`;
}

export async function sendBulkWhatsApp(
  recipients: { phone: string; name: string }[],
  message: string,
  onProgress?: (sent: number, total: number) => void
): Promise<{ sent: number; failed: string[] }> {
  const failed: string[] = [];
  let sent = 0;

  for (const r of recipients) {
    if (!r.phone) {
      failed.push(`${r.name || 'Bilinmeyen'} (telefon yok)`);
      continue;
    }
    const url = getWhatsAppUrl(r.phone, message);
    if (typeof window !== 'undefined') {
      const w = window.open(url, '_blank');
      if (!w) {
        failed.push(`${r.name} (engellendi)`);
      } else {
        sent++;
      }
    }
    onProgress?.(sent, recipients.length);
    await new Promise((r) => setTimeout(r, 800));
  }

  return { sent, failed };
}
