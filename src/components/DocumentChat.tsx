import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  documentId: string;
  docTitle: string;
  company: string;
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  'Que couvre ce contrat ?',
  'Quelles sont les exclusions ?',
  'Quelles démarches sont prévues en cas de sinistre ?'
];

function ChatIcon({ kind }: { kind: 'document' | 'assistant' | 'user' | 'send' | 'close' }) {
  const paths: Record<typeof kind, JSX.Element> = {
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    assistant: <><path d="M12 2v3M8 3.5l1.2 2.2M16 3.5l-1.2 2.2" /><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M8 12h.01M16 12h.01M9 16h6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>
  };

  return <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function inlineMarkdown(value: string): Array<JSX.Element | string> {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index} class="font-semibold text-[#2f2b24]">{part.slice(2, -2)}</strong>
      : part
  ));
}

function AssistantMessage({ content }: { content: string }) {
  return <div class="space-y-1.5">{content.split('\n').map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <span key={index} class="block h-1" />;
    if (/^#{1,3}\s/.test(trimmed)) return <p key={index} class="font-semibold text-[#2f2b24]">{inlineMarkdown(trimmed.replace(/^#{1,3}\s+/, ''))}</p>;
    if (/^[-*]\s/.test(trimmed)) return <p key={index} class="flex gap-2"><span aria-hidden="true" class="text-[#c08e3a]">•</span><span>{inlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</span></p>;
    return <p key={index}>{inlineMarkdown(trimmed)}</p>;
  })}</div>;
}

export default function DocumentChat({ documentId, docTitle, company, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), a[href]')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleDialogKeys);
    return () => {
      document.removeEventListener('keydown', handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading]);

  async function doSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/document-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, messages: nextMessages })
      });

      if (!response.ok) {
        const body = await response.text();
        try {
          const parsed = JSON.parse(body) as { error?: string };
          throw new Error(parsed.error || `La requête a échoué (${response.status}).`);
        } catch (caught) {
          if (caught instanceof SyntaxError) throw new Error(body || `La requête a échoué (${response.status}).`);
          throw caught;
        }
      }

      if (!response.body) throw new Error("L’assistant n’a renvoyé aucune réponse.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let pending = '';

      function processLine(line: string) {
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') return;

        const parsed = JSON.parse(data) as { content?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) {
          accumulated += parsed.content;
          setMessages([...nextMessages, { role: 'assistant', content: accumulated }]);
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) processLine(line);
      }

      pending += decoder.decode();
      if (pending) processLine(pending);
      if (!accumulated) throw new Error("L’assistant n’a pas renvoyé de réponse. Réessayez dans un instant.");
    } catch (caught) {
      setMessages(nextMessages);
      setError(caught instanceof Error ? caught.message : 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  }

  function submit(event: JSX.TargetedSubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void doSend();
  }

  function handleInputKey(event: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void doSend();
    }
  }

  return (
    <div class="fixed inset-0 z-[100]">
      <div class="absolute inset-0 bg-[#2f2b24]/55 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />

      <aside ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="document-chat-title" class="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col bg-[#f7f0e4] shadow-[-24px_0_70px_rgba(47,43,36,.28)]">
        <header class="flex items-start gap-3 bg-[#2f2b24] px-5 py-5 text-[#f7f0e4]">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#c08e3a]/20 text-[#d4b895]"><ChatIcon kind="document" /></span>
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-semibold tracking-[.12em] text-[#cbb990] uppercase">{company}</p>
            <h2 id="document-chat-title" class="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{docTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer l’assistant" class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#d8cbb6] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4b895]"><ChatIcon kind="close" /></button>
        </header>

        <div class="flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
          {messages.length === 0 && (
            <div class="mx-auto max-w-sm py-10 text-center">
              <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#606c38]/12 text-[#606c38]"><ChatIcon kind="assistant" /></span>
              <h3 class="mt-4 font-semibold text-[#2f2b24]">Assistant documents BDTS</h3>
              <p class="mt-2 text-sm leading-6 text-[#766952]">Posez une question précise. L’assistant lit ce document et répond uniquement à partir de son contenu.</p>
              <div class="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((question) => <button type="button" key={question} onClick={() => { setInput(question); inputRef.current?.focus(); }} class="rounded-full border border-[#d8cbb6] bg-white px-3 py-2 text-xs font-medium text-[#554c3c] transition-colors hover:border-[#c08e3a] hover:text-[#8b6126] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c08e3a]">{question}</button>)}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} class={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#606c38]/12 text-[#606c38]"><ChatIcon kind="assistant" /></span>}
              <div class={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-tr-sm bg-[#2f2b24] text-[#f7f0e4]' : 'rounded-tl-sm border border-[#dfd2bd] bg-white text-[#403a30]'}`}>
                {message.content ? (message.role === 'assistant' ? <AssistantMessage content={message.content} /> : message.content) : <span class="inline-flex items-center gap-2 text-[#766952]"><span class="h-2 w-2 animate-pulse rounded-full bg-[#c08e3a]" />Lecture du document…</span>}
              </div>
              {message.role === 'user' && <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#2f2b24]/10 text-[#2f2b24]"><ChatIcon kind="user" /></span>}
            </div>
          ))}

          {error && <div role="alert" class="rounded-xl border border-[#d69b83] bg-[#f7e4da] px-4 py-3 text-sm leading-5 text-[#7d402d]">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <footer class="border-t border-[#d8cbb6] bg-white px-4 py-4">
          <form onSubmit={submit} class="flex items-end gap-2">
            <label class="sr-only" for="document-chat-input">Votre question sur le document</label>
            <textarea id="document-chat-input" ref={inputRef} value={input} onInput={(event) => setInput((event.target as HTMLTextAreaElement).value)} onKeyDown={handleInputKey} disabled={loading} rows={2} maxLength={4000} placeholder="Posez une question sur ce document…" class="min-h-[48px] flex-1 resize-none rounded-xl border border-[#d8cbb6] bg-[#f7f0e4] px-3 py-2.5 text-sm text-[#2f2b24] placeholder:text-[#8b806d] focus:border-[#c08e3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c08e3a]/30 disabled:opacity-60" />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Envoyer la question" class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#c08e3a] text-white transition-colors hover:bg-[#a8752f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c08e3a] disabled:cursor-not-allowed disabled:opacity-40"><ChatIcon kind="send" /></button>
          </form>
          <p class="mt-2 text-center text-[11px] text-[#8b806d]">Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</p>
        </footer>
      </aside>
    </div>
  );
}
