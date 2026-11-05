import { Mic } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState, type FormEvent } from 'react';
import { useGame } from '../../store/game';

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (event: { results: { 0: { transcript: string } }[] }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function speechRecognition() {
  const speech = window as SpeechWindow;
  return speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
}

export function TopicInput({ centered }: { centered: boolean }) {
  const submitTopic = useGame((state) => state.submitTopic);
  const submitting = useGame((state) => state.submitting);
  const error = useGame((state) => state.error);
  const [topic, setTopic] = useState('');
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const Speech = speechRecognition();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await submitTopic(topic)) setTopic('');
  }

  function toggleVoice() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (!Speech) return;
    const listener = new Speech();
    listener.lang = 'en-US';
    listener.interimResults = true;
    listener.onresult = (event) => {
      setTopic(Array.from(event.results, (result) => result[0].transcript).join(''));
    };
    listener.onend = () => setListening(false);
    listener.onerror = () => setListening(false);
    recognition.current = listener;
    setListening(true);
    listener.start();
  }

  return (
    <motion.form
      layout
      onSubmit={(event) => void submit(event)}
      className={`absolute left-1/2 z-10 w-[min(560px,calc(100%-32px))] -translate-x-1/2 ${
        centered ? 'top-1/2 -translate-y-1/2' : 'bottom-6'
      }`}
    >
      {centered && (
        <h2 className="mb-5 text-center font-display text-5xl leading-tight italic">
          What are you curious about?
        </h2>
      )}
      <div className="flex items-center gap-2 rounded-full border border-rule bg-panel/90 py-1.5 pr-1.5 pl-5 focus-within:border-mist">
        <label htmlFor="topic" className="sr-only">
          What are you curious about?
        </label>
        <input
          id="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder={centered ? 'The French Revolution' : 'Learn something new'}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-lg outline-none placeholder:text-mist/60"
        />
        {Speech && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? 'Stop listening' : 'Say a topic'}
            aria-pressed={listening}
            className={`rounded-full p-2 ${listening ? 'bg-history text-void' : 'text-mist hover:text-ink'}`}
          >
            <Mic size={20} />
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || topic.trim().length < 3}
          className="rounded-full bg-gold px-4 py-2 font-semibold text-void disabled:opacity-40"
        >
          Map it
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-history">
          {error}
        </p>
      )}
    </motion.form>
  );
}
