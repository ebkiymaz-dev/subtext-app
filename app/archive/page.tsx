"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ContinueConversation from '@/components/ContinueConversation';
import { hasActiveRead } from "@/lib/active-read";
import {
  createLocalProfile,
  deleteArchivedConversation,
  deleteLocalProfile,
  readArchive,
  readLocalProfile,
  type ArchivedConversation,
  type LocalProfile,
} from "@/lib/archive";

export default function ArchivePage() {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [items, setItems] = useState<ArchivedConversation[]>([]);
  const [name, setName] = useState("");
  const [error,setError]=useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeReadOpen, setActiveReadOpen] = useState(false);

  useEffect(() => {
    setProfile(readLocalProfile());
    try{setItems(readArchive(true));}catch(e){setError((e as Error).message)}
    setActiveReadOpen(hasActiveRead());
  }, []);

  const activeReadBanner = activeReadOpen ? (
    <aside className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sbt border border-sbt-gold/35 bg-sbt-gold/[0.07] p-4">
      <div>
        <p className="text-sm font-semibold text-sbt-ink">Your current analysis is still open</p>
        <p className="mt-0.5 text-xs text-sbt-mute">Return to it without losing the result.</p>
      </div>
      <Link href="/" className="rounded-sbt bg-sbt-ink px-4 py-2.5 text-sm font-semibold text-sbt-paper">
        Return to current read
      </Link>
    </aside>
  ) : null;

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl">
        {activeReadBanner}
        <section className="rounded-sbt border border-sbt-gold/30 bg-white/75 p-5 shadow-soft sm:p-8">
          <p className="text-[10px] uppercase tracking-widest text-sbt-gold-700">optional local profile</p>
          <h1 className="mt-2 font-display text-3xl text-sbt-ink">Keep reads on this device</h1>
          <p className="mt-3 text-sm leading-7 text-sbt-dusk">
            Create a private profile only if you want an archive. There is no login and nothing syncs
            to Subtext—your profile and saved conversations stay in this app&apos;s local storage.
          </p>
          <label className="mt-5 block text-xs font-medium uppercase tracking-wider text-sbt-mute" htmlFor="profile-name">
            Your profile name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="For example: Efe"
            className="mt-2 w-full rounded-sbt border border-sbt-linen bg-sbt-paper px-4 py-3 text-sbt-ink outline-none focus:ring-2 focus:ring-sbt-gold/30"
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              try{const next = createLocalProfile(name);setProfile(next);setName('');setError('')}catch{setError('Profile could not be saved on this device. Nothing was uploaded.')}
            }}
            className="mt-4 min-h-11 w-full rounded-sbt bg-sbt-gold-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            Create private profile
          </button>
          {error?<p role="alert" className="mt-3 text-sm text-sbt-rose">{error}</p>:null}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {error?<p role="alert" className="text-sm text-sbt-rose">{error}</p>:null}
      {activeReadBanner}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-sbt-gold-700">
            {profile.name === "Private archive" ? "Private archive" : `${profile.name}'s private archive`}
          </p>
          <h1 className="mt-1 font-display text-3xl text-sbt-ink">Saved conversations</h1>
          <p className="mt-2 text-sm text-sbt-mute">Stored locally by Subtext on this device. Subtext does not sync or upload the archive.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Delete this local profile and every saved conversation?")) return;
            deleteLocalProfile();
            setProfile(null);
            setItems([]);
          }}
          className="rounded-sbt border border-sbt-rose/30 px-3 py-2 text-xs text-sbt-rose"
        >
          Delete local profile
        </button>
      </header>

      {items.length ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-sbt border border-sbt-linen bg-white/75 p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => setOpenId(openId === item.id ? null : item.id)} className="min-w-0 flex-1 text-left">
                  <p className="font-display text-lg text-sbt-ink">{item.title}</p>
                  <p className="mt-1 text-xs text-sbt-mute">
                    {new Date(item.createdAt).toLocaleString()} · conversation with {item.otherName}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-sbt-dusk">{item.headline}</p>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  onClick={() => {if(!confirm('Delete this saved conversation?'))return;try{setItems(deleteArchivedConversation(item.id))}catch(e){setError((e as Error).message)}}}
                  className="text-xs text-sbt-rose"
                >
                  Delete
                </button>
              </div>
              <ContinueConversation key={item.id} saved={item} />
              {openId === item.id ? (
                <div className="mt-4 border-t border-sbt-linen pt-4">
                  <pre className="thin-scroll max-h-72 overflow-auto whitespace-pre-wrap rounded-sbt bg-sbt-paper p-3 font-body text-xs leading-relaxed text-sbt-dusk">
                    {item.raw}
                  </pre>
                  <ul className="mt-3 space-y-2">
                    {item.categories.slice(0, 5).map((category) => (
                      <li key={category.id} className="text-xs leading-relaxed text-sbt-dusk">
                        <strong>{category.label}: {category.percent >= 65 ? "strong" : category.percent >= 35 ? "moderate" : "weak"} evidence</strong> — {category.read}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <section className="rounded-sbt border border-dashed border-sbt-gold/40 bg-sbt-gold/[0.04] p-8 text-center">
          <h2 className="font-display text-xl text-sbt-ink">Nothing saved yet</h2>
          <p className="mt-2 text-sm text-sbt-mute">After a read, choose “Save to archive” to place it here.</p>
        </section>
      )}
    </div>
  );
}
