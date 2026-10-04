"use client";
import {useEffect, useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import type {ArchivedConversation} from '@/lib/archive';
import {previewContinuation, stageContinuedRead} from '@/lib/conversation-continuity';
import {readChatScreenshot} from '@/lib/screenshot-ocr';

export default function ContinueConversation({saved}: {saved: ArchivedConversation}) {
  const router=useRouter();
  const [incoming,setIncoming]=useState('');
  const [remove,setRemove]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const generation=useRef(0);
  useEffect(()=>()=>{generation.current++},[]);
  const preview=useMemo(()=>{try{return {data:previewContinuation(saved.raw,incoming,remove),error:''}}catch(e){return {data:null,error:(e as Error).message}}},[saved.raw,incoming,remove]);
  return <details className="mt-4 rounded-sbt border border-sbt-gold/30 p-4">
    <summary className="cursor-pointer py-2 font-semibold">Continue this conversation</summary>
    <p className="my-3 text-xs text-sbt-mute">Add the next messages. Your original archive stays unchanged; the new read is not saved until you choose Save to archive.</p>
    <label className="block text-sm">New messages<textarea value={incoming} maxLength={12000} disabled={busy} onChange={e=>{generation.current++;setIncoming(e.target.value);setConfirmed(false);setRemove(false)}} rows={5} className="mt-2 w-full rounded-sbt border border-sbt-linen bg-sbt-paper p-3" placeholder="Alex: The new message…"/></label>
    <label className="mt-3 block text-sm">Or add a screenshot<input type="file" accept="image/*" disabled={busy} className="mt-2 block w-full text-xs" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const ticket=++generation.current;setBusy(true);setConfirmed(false);try{const result=await readChatScreenshot(file);if(ticket===generation.current){setIncoming(result.transcript);setRemove(false);setNotice('Check the extracted words and names. Screenshot recognition can make mistakes.')}}catch{setNotice('Screenshot could not be read. Paste the new messages instead.')}finally{setBusy(false)}}}/></label>
    {busy?<p role="status">Reading screenshot on this device…</p>:null}
    {notice?<p role="status" className="mt-2 text-xs">{notice}</p>:null}
    {incoming && preview.error?<p role="alert" className="mt-3 text-sm text-sbt-rose">{preview.error}</p>:null}
    {preview.data?<>
      <p className="mt-3 text-sm">{preview.data.added} messages to add. {preview.data.newNames.length?`New names: ${preview.data.newNames.join(', ')}. Verify who they are.`:'Existing speaker names retained.'}</p>
      {preview.data.overlap>0?<label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={remove} onChange={e=>{setRemove(e.target.checked);setConfirmed(false)}}/>Remove {preview.data.overlap} matching boundary messages only if these are the same messages, not new repeated replies.</label>:null}
      <details className="my-3"><summary>Preview combined conversation</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{preview.data.combined}</pre></details>
      {preview.data.newQuestions.length?<p className="my-2 text-xs">New question text to review: {preview.data.newQuestions.join(' · ')}</p>:null}
      <label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>These messages belong to this conversation; I checked their order and names.</label>
      <button disabled={!confirmed||busy||preview.data.added===0} className="min-h-11 rounded-sbt bg-sbt-ink px-4 text-sbt-paper disabled:opacity-40" onClick={()=>{if(!preview.data)return;if(!window.confirm('Open this combined conversation in Read? This replaces the current unsaved reader workspace. The saved archive stays unchanged.'))return;stageContinuedRead({raw:preview.data.combined,context:saved.context,familiarity:saved.familiarity,sourceId:saved.id,notice:`Continued saved conversation: ${preview.data.added} messages added. Review speakers and analyze again; the previous interpretation was not reused.`});router.push('/')}}>Review updated conversation</button>
    </>:null}
  </details>;
}
