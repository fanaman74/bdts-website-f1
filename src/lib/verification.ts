import { sendEmail } from './email';
import { createVerificationToken, setVerificationToken, type User } from './users';

/**
 * Generates a verification token, stores only its hash, and emails the link.
 *
 * Returns whether the message left successfully; a send failure is logged and
 * reported rather than thrown, so registration never dies because mail is down.
 */
export async function sendVerificationEmail(user: User, origin: string): Promise<boolean> {
  const { token, hash } = createVerificationToken();
  await setVerificationToken(user.id, hash);

  const link = `${origin}/admin/verify?token=${encodeURIComponent(token)}`;

  return sendEmail({
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
}
