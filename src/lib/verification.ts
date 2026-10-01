import { sendEmail } from './email';
import { createVerificationToken, recordVerificationOutcome, setVerificationToken, type User } from './users';

/**
 * Generates a verification token, stores only its hash, and emails the link.
 *
 * Returns whether the message was accepted by the provider, and records the
 * outcome on the account either way so a silent rejection is visible from the
 * admin area rather than only in the server log.
 */
export async function sendVerificationEmail(user: User, origin: string): Promise<boolean> {
  const { token, hash } = createVerificationToken();
  await setVerificationToken(user.id, hash);

  const link = `${origin}/admin/verify?token=${encodeURIComponent(token)}`;

  const result = await sendEmail({
    to: user.email,
    subject: 'Confirmez votre adresse e-mail — BDT Sironval',
    text: [
      'Bonjour,',
      '',
      'Confirmez votre adresse e-mail pour activer votre compte d’administration :',
      '',
      link,
      '',
      'Ce lien expire dans 24 heures et ne peut servir qu’une fois.',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.'
    ].join('\n')
  });

  await recordVerificationOutcome(user.id, result.ok ? null : result.error);
  return result.ok;
}
