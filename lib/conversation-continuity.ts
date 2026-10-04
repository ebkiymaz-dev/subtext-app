import { segment } from './engine/segment';
import type { ContextId, FamiliarityId } from './engine/types';

/** Only matching boundary messages are candidates for removal; repeated phrases elsewhere remain. */
export function previewContinuation(previous: string, incoming: string, removeOverlap = false) {
  if (!incoming.trim()) throw new Error('Add the new messages first.');
  const a = segment(previous), b = segment(incoming);
  if (![a, b].every(t => t.format === 'named' || t.format === 'whatsapp')) throw new Error('Label each message with a speaker name before combining conversations.');
  const key = (m: typeof a.messages[number]) => `${m.name.normalize('NFC')}\n${m.text.normalize('NFC').trim()}`;
  let overlap = 0;
  for (let n = 1; n <= Math.min(a.messages.length, b.messages.length); n++) {
    if (a.messages.slice(-n).every((m, i) => key(m) === key(b.messages[i]))) overlap = n;
  }
  const added = b.messages.slice(removeOverlap ? overlap : 0);
  const newNames = b.names.filter(name => !a.names.includes(name));
  // The saved, speaker-corrected transcript is preserved verbatim.
  const combined = previous.trim() + (added.length ? '\n' + added.map(m => `${m.name}: ${m.text}`).join('\n') : '');
  if (combined.length > 12000) throw new Error('The combined conversation exceeds 12,000 characters. Shorten the input deliberately; nothing was removed.');
  return { combined, overlap, added: added.length, newNames, newQuestions: added.filter(m => /[?？]/u.test(m.text)).map(m => `${m.name}: ${m.text}`).slice(0, 5) };
}

export interface ContinuedRead { raw: string; context: ContextId; familiarity: FamiliarityId; sourceId: string; notice: string }
let pending: ContinuedRead | null = null;
export function stageContinuedRead(value: ContinuedRead) { pending = value; }
export function consumeContinuedRead() { const value = pending; pending = null; return value; }
export function clearContinuedRead() { pending = null; }
