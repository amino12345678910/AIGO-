"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";

interface QuizQuestion {
  type: "mcq" | "truefalse" | "text";
  question: string;
  options?: string[];
  correct: number | boolean | string;
  explanation: string;
}

interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

function parseQuiz(raw: string): QuizData | null {
  try {
    const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
    const data = JSON.parse(cleaned);
    if (data.title && Array.isArray(data.questions) && data.questions.length > 0) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function McqQuestion({
  q,
  index,
  answered,
  selected,
  onSelect,
}: {
  q: QuizQuestion;
  index: number;
  answered: boolean;
  selected: number | null;
  onSelect: (idx: number) => void;
}) {
  const correctIdx = q.correct as number;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{index + 1}. {q.question}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {q.options?.map((opt, i) => {
          let style = "border border-border hover:bg-accent text-left justify-start h-auto py-2.5 px-3 text-sm whitespace-normal";
          if (answered) {
            if (i === correctIdx) {
              style = "border border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 text-left justify-start h-auto py-2.5 px-3 text-sm whitespace-normal";
            } else if (i === selected && i !== correctIdx) {
              style = "border border-red-500 bg-red-500/10 text-red-700 dark:text-red-400 text-left justify-start h-auto py-2.5 px-3 text-sm whitespace-normal";
            } else {
              style = "border border-border opacity-50 text-left justify-start h-auto py-2.5 px-3 text-sm whitespace-normal";
            }
          } else if (i === selected) {
            style = "border border-primary bg-primary/10 text-left justify-start h-auto py-2.5 px-3 text-sm whitespace-normal";
          }
          return (
            <Button
              key={i}
              variant="outline"
              className={style}
              disabled={answered}
              onClick={() => onSelect(i)}
            >
              <span className="font-mono text-xs mr-2 opacity-50">{String.fromCharCode(65 + i)}</span>
              {opt}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function TrueFalseQuestion({
  q,
  index,
  answered,
  selected,
  onSelect,
}: {
  q: QuizQuestion;
  index: number;
  answered: boolean;
  selected: boolean | null;
  onSelect: (val: boolean) => void;
}) {
  const correctVal = q.correct as boolean;
  const options: [boolean, string][] = [[true, "True"], [false, "False"]];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{index + 1}. {q.question}</p>
      <div className="flex gap-2">
        {options.map(([val, label]) => {
          let style = "flex-1 border border-border hover:bg-accent";
          if (answered) {
            if (val === correctVal) {
              style = "flex-1 border border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
            } else if (val === selected && val !== correctVal) {
              style = "flex-1 border border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
            } else {
              style = "flex-1 border border-border opacity-50";
            }
          } else if (val === selected) {
            style = "flex-1 border border-primary bg-primary/10";
          }
          return (
            <Button
              key={label}
              variant="outline"
              className={style}
              disabled={answered}
              onClick={() => onSelect(val)}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function TextQuestion({
  q,
  index,
  answered,
  value,
  onsubmit,
}: {
  q: QuizQuestion;
  index: number;
  answered: boolean;
  value: string;
  onsubmit: (val: string) => void;
}) {
  const [localVal, setLocalVal] = useState("");
  const correctStr = String(q.correct).toLowerCase();

  let inputStyle = "flex-1";
  if (answered) {
    inputStyle = localVal.trim().toLowerCase() === correctStr
      ? "flex-1 border-green-500 bg-green-500/10"
      : "flex-1 border-red-500 bg-red-500/10";
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{index + 1}. {q.question}</p>
      <div className="flex gap-2">
        <Input
          value={answered ? value : localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          disabled={answered}
          placeholder="Type your answer..."
          className={inputStyle}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !answered && localVal.trim()) {
              onsubmit(localVal);
            }
          }}
        />
        {!answered && (
          <Button
            variant="outline"
            size="sm"
            disabled={!localVal.trim()}
            onClick={() => onsubmit(localVal)}
          >
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}

export function InteractiveQuiz({ chart }: { chart: string }) {
  const quiz = useMemo(() => parseQuiz(chart), [chart]);

  const [answers, setAnswers] = useState<Record<number, number | boolean | string>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  if (!quiz) {
    return (
      <div className="my-2 p-3 rounded-md border border-destructive bg-destructive/5 text-sm text-destructive">
        Failed to load quiz. Invalid format.
      </div>
    );
  }

  const totalQuestions = quiz.questions.length;
  const answeredCount = Object.keys(submitted).length;
  const score = Object.entries(submitted).filter(([idx, _]) => {
    const q = quiz.questions[parseInt(idx)];
    const ans = answers[parseInt(idx)];
    if (q.type === "mcq") return ans === (q.correct as number);
    if (q.type === "truefalse") return ans === (q.correct as boolean);
    if (q.type === "text") return String(ans).toLowerCase() === String(q.correct).toLowerCase();
    return false;
  }).length;

  const allDone = answeredCount === totalQuestions;

  const submitAnswer = (idx: number) => {
    setSubmitted((prev) => ({ ...prev, [idx]: true }));
  };

  const reset = () => {
    setAnswers({});
    setSubmitted({});
    setShowAll(true);
  };

  return (
    <div className="my-3 rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <h4 className="text-sm font-semibold">{quiz.title}</h4>
        {answeredCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {score}/{answeredCount} correct
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {quiz.questions.map((q, i) => {
          const isSubmitted = submitted[i];
          const isVisible = showAll || isSubmitted || i <= Math.max(0, ...Object.keys(submitted).map(Number));

          if (!isVisible && !showAll) {
            if (i > 0 && !submitted[i - 1] && !showAll) return null;
          }

          return (
            <div
              key={i}
              className={`p-3 rounded-md border transition-colors ${
                isSubmitted
                  ? answers[i] !== undefined &&
                    (
                      (q.type === "mcq" && answers[i] === q.correct) ||
                      (q.type === "truefalse" && answers[i] === q.correct) ||
                      (q.type === "text" && String(answers[i]).toLowerCase() === String(q.correct).toLowerCase())
                    )
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-red-500/30 bg-red-500/5"
                  : "border-border"
              }`}
            >
              {q.type === "mcq" && (
                <McqQuestion
                  q={q}
                  index={i}
                  answered={isSubmitted}
                  selected={answers[i] as number | null}
                  onSelect={(val) => {
                    if (!isSubmitted) {
                      setAnswers((prev) => ({ ...prev, [i]: val }));
                      setTimeout(() => submitAnswer(i), 300);
                    }
                  }}
                />
              )}
              {q.type === "truefalse" && (
                <TrueFalseQuestion
                  q={q}
                  index={i}
                  answered={isSubmitted}
                  selected={answers[i] as boolean | null}
                  onSelect={(val) => {
                    if (!isSubmitted) {
                      setAnswers((prev) => ({ ...prev, [i]: val }));
                      setTimeout(() => submitAnswer(i), 300);
                    }
                  }}
                />
              )}
              {q.type === "text" && (
                <TextQuestion
                  q={q}
                  index={i}
                  answered={isSubmitted}
                  value={String(answers[i] || "")}
                  onsubmit={(val) => {
                    setAnswers((prev) => ({ ...prev, [i]: val }));
                    submitAnswer(i);
                  }}
                />
              )}

              {isSubmitted && (
                <div className="mt-2 flex items-start gap-2 text-xs">
                  {(
                    (q.type === "mcq" && answers[i] === q.correct) ||
                    (q.type === "truefalse" && answers[i] === q.correct) ||
                    (q.type === "text" && String(answers[i]).toLowerCase() === String(q.correct).toLowerCase())
                  ) ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <p className="text-muted-foreground">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}

        {allDone && (
          <div className="text-center pt-2 border-t border-border">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-semibold">
                Score: {score}/{totalQuestions} ({Math.round((score / totalQuestions) * 100)}%)
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
