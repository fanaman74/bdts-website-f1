import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import type { DeclarationInput } from './declarations';
import { declarationSections } from './declarationSummary';
import { DECLARATION_LOCALES, declarationText, type DeclarationLanguage } from './declarationI18n';

/**
 * The PDF summary of a claim declaration, sent to the customer with their
 * confirmation email and to the office with its notification.
 */

export interface DeclarationPdfInput {
  reference: string;
  submittedAt: Date;
  declaration: DeclarationInput;
  attachmentNames: string[];
  language: DeclarationLanguage;
}

const BRAND = '#606c38';
const INK = '#2f2b24';
const MUTED = '#77705f';
const RULE = '#dcd6c8';
const PANEL = '#f4f1ea';

const OFFICE_LINE = 'BDTS · Rue de Wand 29, 1020 Bruxelles · +32 2 463 19 25 · bdts@bdts.be';

const PAGE_MARGIN = 50;
const FOOTER_SPACE = 40;
const LABEL_WIDTH = 150;
const COLUMN_GAP = 14;

/**
 * The built-in PDF fonts only cover Windows-1252. Accented Latin letters
 * outside it (ł, ő, ș…) lose their accent rather than printing as garbage,
 * and anything else becomes "?".
 */
const WIN_ANSI_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
/** Letters that are not "base letter + accent" in Unicode, so NFKD leaves them alone. */
const LATIN_FALLBACKS: Record<string, string> = { Ł: 'L', ł: 'l', Đ: 'D', đ: 'd', Ħ: 'H', ħ: 'h', ı: 'i' };
function pdfSafe(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (char === '\n' || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(char)) {
      out += char;
      continue;
    }
    if (char === '\t') {
      out += ' ';
      continue;
    }
    if (char === '\r') continue;
    if (LATIN_FALLBACKS[char]) {
      out += LATIN_FALLBACKS[char];
      continue;
    }
    const stripped = char.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    out += /^[\x20-\x7e]+$/.test(stripped) ? stripped : '?';
  }
  return out;
}

/** The logo from the built site, or the source tree in development; null if neither is there. */
function logoBytes(): Buffer | null {
  for (const candidate of ['dist/client/images/logo-bdts.png', 'public/images/logo-bdts.png']) {
    const path = join(process.cwd(), candidate);
    if (existsSync(path)) {
      try {
        return readFileSync(path);
      } catch {
        // fall through to the next candidate
      }
    }
  }
  return null;
}

const stamp = (date: Date, language: DeclarationLanguage) =>
  new Intl.DateTimeFormat(DECLARATION_LOCALES[language], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Brussels'
  }).format(date);

export function renderDeclarationPdf(input: DeclarationPdfInput): Promise<Buffer> {
  const t = (french: string, values?: Record<string, string | number>) => declarationText(input.language, french, values);
  const doc = new PDFDocument({
    size: 'A4',
    // The footer lives in the extra bottom margin, so flowing text never runs into it.
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN + FOOTER_SPACE, left: PAGE_MARGIN, right: PAGE_MARGIN },
    bufferPages: true,
    info: {
      Title: `${t('Déclaration de sinistre')} ${input.reference}`,
      Author: 'BDTS',
      Subject: t('Récapitulatif de déclaration de sinistre')
    }
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = PAGE_MARGIN;
  const width = doc.page.width - PAGE_MARGIN * 2;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  /** Starts a new page when the next block would run into the footer. */
  const ensureSpace = (height: number) => {
    if (doc.y + height > bottom()) {
      doc.addPage();
      doc.y = PAGE_MARGIN;
    }
  };

  // Header: logo and office name on the left, the document title on the right.
  const logo = logoBytes();
  const headerTop = PAGE_MARGIN;
  if (logo) {
    doc.image(logo, left, headerTop, { height: 52 });
  } else {
    doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND).text('BDTS', left, headerTop + 10);
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(INK)
    .text(pdfSafe(t('Déclaration de sinistre')), left, headerTop + 4, { width, align: 'right' });
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(MUTED)
    .text(pdfSafe(t('Récapitulatif de votre déclaration en ligne')), left, headerTop + 28, { width, align: 'right' });

  doc.moveTo(left, headerTop + 60).lineTo(left + width, headerTop + 60).lineWidth(1.5).strokeColor(BRAND).stroke();

  // Reference panel.
  const panelTop = headerTop + 74;
  doc.roundedRect(left, panelTop, width, 48, 6).fillColor(PANEL).fill();
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(pdfSafe(t('Référence').toUpperCase()), left + 16, panelTop + 10);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND).text(input.reference, left + 16, panelTop + 22);
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(pdfSafe(t('Reçue le').toUpperCase()), left + width / 2, panelTop + 10);
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(INK)
    .text(pdfSafe(stamp(input.submittedAt, input.language)), left + width / 2, panelTop + 24, { width: width / 2 - 16 });

  doc.y = panelTop + 66;

  const sectionHeading = (title: string) => {
    ensureSpace(40);
    doc.y += 10;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text(pdfSafe(title.toUpperCase()), left, doc.y, {
      width,
      characterSpacing: 0.6
    });
    const ruleY = doc.y + 3;
    doc.moveTo(left, ruleY).lineTo(left + width, ruleY).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.y = ruleY + 8;
  };

  const valueX = left + LABEL_WIDTH + COLUMN_GAP;
  const valueWidth = width - LABEL_WIDTH - COLUMN_GAP;

  const row = (label: string, value: string) => {
    const safeLabel = pdfSafe(label);
    const safeValue = pdfSafe(value);
    doc.font('Helvetica').fontSize(9);
    const labelHeight = doc.heightOfString(safeLabel, { width: LABEL_WIDTH });
    doc.font('Helvetica').fontSize(10);
    const valueHeight = doc.heightOfString(safeValue, { width: valueWidth, lineGap: 1.5 });

    // A long text (the circumstances) may be taller than a page: let it flow
    // over the break instead of pushing it to an empty page first.
    ensureSpace(Math.min(Math.max(labelHeight, valueHeight), 60));
    const y = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(safeLabel, left, y + 0.5, { width: LABEL_WIDTH });
    const afterLabel = doc.y;
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(safeValue, valueX, y, { width: valueWidth, lineGap: 1.5 });
    // When the value flowed onto a new page, carry on from where it ended.
    doc.y = doc.y < y ? doc.y + 5 : Math.max(afterLabel, doc.y) + 5;
  };

  const note = (text: string) => {
    ensureSpace(20);
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text(pdfSafe(text), left, doc.y, { width });
    doc.y += 6;
  };

  for (const section of declarationSections(input.declaration, input.language)) {
    if (section.rows.length === 0 && !section.note) continue;
    sectionHeading(section.title);
    if (section.note) note(section.note);
    for (const [label, value] of section.rows) row(label, value);
  }

  sectionHeading(t('Pièces jointes'));
  if (input.attachmentNames.length === 0) {
    note(t('Aucun fichier joint.'));
  } else {
    input.attachmentNames.forEach((name, index) => row(t('Fichier {n}', { n: index + 1 }), name));
  }

  ensureSpace(60);
  doc.y += 14;
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(MUTED)
    .text(
      pdfSafe(
        t(
          'Ce document reprend les informations que vous nous avez transmises via notre site. Il ne constitue pas une acceptation du sinistre par la compagnie d’assurance. Conservez la référence ci-dessus pour tout échange avec notre bureau.'
        )
      ),
      left,
      doc.y,
      { width, lineGap: 1.5 }
    );

  // Footer on every page, drawn last so the page count is known.
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    // Writing below the bottom margin would otherwise open a new page.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - PAGE_MARGIN - 12;
    doc.moveTo(left, footerY - 8).lineTo(left + width, footerY - 8).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(pdfSafe(OFFICE_LINE), left, footerY, { width: width - 80, lineBreak: false });
    doc.text(`${input.reference} · ${index - range.start + 1}/${range.count}`, left, footerY, {
      width,
      align: 'right',
      lineBreak: false
    });
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  return done;
}
