// Emails the office when a contact, quote or claim form is submitted.
// Uses Resend's HTTP API directly; without RESEND_API_KEY and
// INQUIRY_NOTIFY_TO the inquiry is still stored, only the email is skipped.
// The sender defaults to EMAIL_FROM, the address account emails already use.

export interface InquiryNotification {
  formType: 'contact' | 'devis' | 'declaration';
  name: string;
  email: string;
  phone: string;
  message: string;
  /** Files to attach, base64-encoded (the claim PDF). */
  attachments?: Array<{ filename: string; contentBase64: string }>;
}

const FORM_LABELS: Record<InquiryNotification['formType'], string> = {
  contact: 'Demande de contact',
  devis: 'Demande de devis',
  declaration: 'Déclaration de sinistre'
};

export async function sendInquiryNotification(inquiry: InquiryNotification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipients = (process.env.INQUIRY_NOTIFY_TO ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!apiKey || recipients.length === 0) {
    console.warn('[contact] Email notification skipped: RESEND_API_KEY or INQUIRY_NOTIFY_TO is not set.');
    return;
  }

  const from = process.env.INQUIRY_NOTIFY_FROM?.trim() || process.env.EMAIL_FROM?.trim() || 'BDTS Website <onboarding@resend.dev>';
  const label = FORM_LABELS[inquiry.formType];
  const text = [
    `${label} reçue via le site web.`,
    '',
    `Nom : ${inquiry.name}`,
    `E-mail : ${inquiry.email}`,
    `Téléphone : ${inquiry.phone}`,
    '',
    'Message :',
    inquiry.message,
    '',
    'La demande est également enregistrée dans l’espace d’administration (/admin).'
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: recipients,
        reply_to: inquiry.email,
        subject: `${label} — ${inquiry.name.replace(/[\r\n]+/g, ' ')}`,
        text,
        ...(inquiry.attachments?.length
          ? { attachments: inquiry.attachments.map((file) => ({ filename: file.filename, content: file.contentBase64 })) }
          : {})
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      console.error('[contact] Email notification failed:', response.status, (await response.text()).slice(0, 300));
    }
  } catch (error) {
    console.error('[contact] Email notification failed:', error instanceof Error ? error.message : 'unknown error');
  }
}
