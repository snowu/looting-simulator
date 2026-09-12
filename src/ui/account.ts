import type { Session } from '@supabase/supabase-js';
import { btn, h } from './dom';
import { cloudConfigured, currentSession, onSession, requestCode, signOut, verifyCode } from '../cloud/supabase';

/**
 * Sign-in by emailed code, and the small account block that follows it.
 *
 * A code is typed rather than a link clicked: a link carries a verifier tied to
 * the browser that asked for it, so opening the mail on a phone to continue a
 * save started on a laptop is exactly the case it fails. A six-digit code works
 * wherever the player actually wants to play.
 *
 * Nothing here is load-bearing for the game. Cloud sync is opt-in, so every
 * state this panel can be in — including "not configured" and "the network is
 * gone" — has to leave the game entirely playable.
 */

type Stage =
  | { name: 'out' }
  | { name: 'email' }
  | { name: 'sending'; email: string }
  | { name: 'code'; email: string }
  | { name: 'verifying'; email: string }
  | { name: 'in'; email: string };

export interface AccountOpts {
  /** A session arrived: reconcile local and cloud saves. */
  onSignedIn: (session: Session) => void;
  /** The player signed out. The local save is deliberately left alone. */
  onSignedOut: () => void;
}

export class AccountPanel {
  readonly el = h('div', { class: 'account' });
  private stage: Stage = { name: 'out' };
  private error = '';
  private note = '';

  constructor(private opts: AccountOpts) {
    this.render();
    void this.restore();
  }

  /** Pick up an existing session, and follow sign-in/out from any tab. */
  private async restore(): Promise<void> {
    if (!cloudConfigured()) return;
    try {
      const session = await currentSession();
      if (session?.user.email) {
        this.stage = { name: 'in', email: session.user.email };
        this.render();
        this.opts.onSignedIn(session);
      }
      await onSession((s) => {
        if (s?.user.email) {
          const changed = this.stage.name !== 'in' || this.stage.email !== s.user.email;
          this.stage = { name: 'in', email: s.user.email };
          this.render();
          if (changed) this.opts.onSignedIn(s);
        } else if (this.stage.name === 'in') {
          this.stage = { name: 'out' };
          this.render();
          this.opts.onSignedOut();
        }
      });
    } catch {
      // No session to restore, or the library could not be fetched. Offline
      // play is the default, so this is not worth telling the player about.
    }
  }

  /** A line of sync status from the coordinator, e.g. "Synced". */
  setNote(text: string): void {
    this.note = text;
    if (this.stage.name === 'in') this.render();
  }

  private fail(e: unknown, fallback: string): void {
    const msg = e instanceof Error ? e.message : '';
    // Supabase says "For security purposes..." when a code was asked for again
    // too soon; the rest reads well enough to show as-is.
    this.error = msg || fallback;
    this.render();
  }

  private async send(email: string): Promise<void> {
    this.error = '';
    this.stage = { name: 'sending', email };
    this.render();
    try {
      await requestCode(email);
      this.stage = { name: 'code', email };
    } catch (e) {
      this.stage = { name: 'email' };
      this.fail(e, 'Could not send the code. Check the address and try again.');
      return;
    }
    this.render();
  }

  private async verify(email: string, code: string): Promise<void> {
    this.error = '';
    this.stage = { name: 'verifying', email };
    this.render();
    try {
      await verifyCode(email, code);
      // onAuthStateChange moves us to 'in' and reconciles the saves.
    } catch (e) {
      this.stage = { name: 'code', email };
      this.fail(e, 'That code did not work. It may have expired.');
    }
  }

  private async out(): Promise<void> {
    try {
      await signOut();
    } catch {
      // Already gone as far as this device is concerned.
    }
    this.stage = { name: 'out' };
    this.note = '';
    this.render();
  }

  render(): void {
    // A build with no Supabase configured plays exactly as it always has.
    if (!cloudConfigured()) {
      this.el.replaceChildren();
      return;
    }
    const kids: (Node | null)[] = [];
    const s = this.stage;

    if (s.name === 'out') {
      kids.push(
        btn('Sync saves across devices', () => {
          this.stage = { name: 'email' };
          this.error = '';
          this.render();
        }, 'small'),
      );
    } else if (s.name === 'email' || s.name === 'sending') {
      const input = h('input', {
        class: 'field',
        attrs: { type: 'email', placeholder: 'you@example.com', autocomplete: 'email', inputmode: 'email' },
      });
      const go = (): void => {
        const email = input.value.trim();
        if (email) void this.send(email);
      };
      input.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') go();
      });
      if (s.name === 'sending') input.value = s.email;
      kids.push(
        h('div', { class: 'row' },
          input,
          btn(s.name === 'sending' ? 'Sending...' : 'Send code', go, 'small primary', s.name === 'sending'),
          btn('Cancel', () => { this.stage = { name: 'out' }; this.error = ''; this.render(); }, 'small'),
        ),
        h('div', { class: 'faint small', text: 'We email a six-digit code. No password, and nothing else is stored.' }),
      );
      if (s.name === 'email') setTimeout(() => input.focus(), 0);
    } else if (s.name === 'code' || s.name === 'verifying') {
      const input = h('input', {
        class: 'field code',
        attrs: { type: 'text', placeholder: '000000', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6' },
      });
      const go = (): void => {
        const code = input.value.trim();
        if (code.length >= 6) void this.verify(s.email, code);
      };
      input.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') go();
      });
      // Codes are pasted as often as typed; submit as soon as one is complete.
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 6);
        if (input.value.length === 6) go();
      });
      kids.push(
        h('div', { class: 'dim small', text: `Code sent to ${s.email}` }),
        h('div', { class: 'row' },
          input,
          btn(s.name === 'verifying' ? 'Checking...' : 'Sign in', go, 'small primary', s.name === 'verifying'),
          btn('Resend', () => void this.send(s.email), 'small', s.name === 'verifying'),
        ),
      );
      if (s.name === 'code') setTimeout(() => input.focus(), 0);
    } else {
      kids.push(
        h('div', { class: 'row' },
          h('span', { class: 'dim small grow', text: s.email }),
          btn('Sign out', () => void this.out(), 'small'),
        ),
        this.note ? h('div', { class: 'faint small', text: this.note }) : null,
      );
    }

    if (this.error) kids.push(h('div', { class: 'red-t small', text: this.error }));
    this.el.replaceChildren(...kids.filter((k): k is Node => k !== null));
  }
}
