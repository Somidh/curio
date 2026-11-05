import type { CheckResult, LessonView } from '@curio/core';
import { useState } from 'react';
import { useGame } from '../../store/game';

type Props = {
  questions: LessonView['questions'];
  onReread: () => void;
};

export function UnderstandingCheck({ questions, onReread }: Props) {
  const submitCheck = useGame((state) => state.submitCheck);
  const closeConcept = useGame((state) => state.closeConcept);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const complete = questions.every((question) => answers[question.id] !== undefined);

  async function check() {
    setChecking(true);
    setResult(await submitCheck(answers));
    setChecking(false);
  }

  function tryAgain() {
    setAnswers({});
    setResult(null);
  }

  return (
    <div>
      <ol className="space-y-7">
        {questions.map((question, number) => {
          const graded = result?.results.find((item) => item.questionId === question.id);
          return (
            <li key={question.id}>
              <fieldset disabled={Boolean(result)}>
                <legend className="font-medium leading-snug">
                  {number + 1}. {question.prompt}
                </legend>
                <div className="mt-3 space-y-2">
                  {question.options.map((option, index) => {
                    const chosen = answers[question.id] === index;
                    const correct = graded?.correctIndex === index;
                    const wrong = graded && chosen && !correct;
                    return (
                      <label
                        key={index}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 leading-snug transition-colors ${
                          correct
                            ? 'border-gold bg-gold/10'
                            : wrong
                              ? 'border-history bg-history/10'
                              : chosen
                                ? 'border-ink bg-ink/5'
                                : 'border-rule hover:border-mist'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          checked={chosen}
                          onChange={() => setAnswers({ ...answers, [question.id]: index })}
                          className="mt-1 accent-[#ffd66b]"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
                {graded && <p className="mt-2 text-sm leading-snug text-mist">{graded.explanation}</p>}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="mt-8" aria-live="polite">
        {!result && (
          <button
            type="button"
            disabled={!complete || checking}
            onClick={() => void check()}
            className="rounded-md bg-gold px-4 py-2.5 font-semibold text-void disabled:opacity-40"
          >
            {checking ? 'Checking' : 'Check my answers'}
          </button>
        )}

        {result?.passed && (
          <>
            <p className="font-display text-2xl italic text-gold">
              {result.score} of {result.total}. This star is yours.
            </p>
            {result.xpGained > 0 && <p className="mt-1 text-mist">+{result.xpGained} XP</p>}
            <button
              type="button"
              onClick={closeConcept}
              className="mt-4 rounded-md bg-gold px-4 py-2.5 font-semibold text-void"
            >
              Back to the sky
            </button>
          </>
        )}

        {result && !result.passed && (
          <>
            <p className="font-display text-2xl italic">
              {result.score} of {result.total}. You need 2 to master this.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={tryAgain}
                className="rounded-md bg-ink px-4 py-2.5 font-semibold text-void"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onReread}
                className="rounded-md border border-rule px-4 py-2.5 hover:border-mist"
              >
                Read the lesson
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
