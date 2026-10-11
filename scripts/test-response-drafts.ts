import { draftTemplateKinds, generateResponseDraft, templateDraft, workflowSteps } from '../src/lib/responseDrafts';

const expected = ['contact', 'devis', 'declaration', 'attestation', 'arrivee', 'declaration_complement'];
for (const kind of expected) {
  if (!draftTemplateKinds().includes(kind)) throw new Error(`missing template: ${kind}`);
  const draft = templateDraft({ kind, customerName: 'Client Test', question: 'Question test' });
  if (!draft.subject || !draft.body.includes('Client Test') || workflowSteps(kind).length < 3) throw new Error(`invalid workflow draft: ${kind}`);
}
if (!templateDraft({ kind: 'contact', customerName: 'A', question: 'X' }).body.includes('X')) throw new Error('question was not interpolated');
const empty = await generateResponseDraft({ kind: 'contact', question: 'x' }, []);
if (empty.ok || !empty.error.includes('document')) throw new Error('empty source selection should fail locally');
const unknown = await generateResponseDraft({ kind: 'contact', question: 'x' }, ['not-a-catalog-document']);
if (unknown.ok || !unknown.error.includes('catalogue')) throw new Error('unknown source selection should fail locally');
console.log('response draft templates: ok');
