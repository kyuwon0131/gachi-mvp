"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import RecordButton, { type Step } from "@/components/RecordButton";
import QuestionCard, { type BankQuestion } from "@/components/QuestionCard";
import ChapterPanel from "@/components/ChapterPanel";
import StageProgress from "@/components/StageProgress";
import OnboardingForm, { type ProfileInput } from "@/components/OnboardingForm";

interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

interface Progress {
  totalAnswered: number;
  totalQuestions: number;
}

export default function Home() {
  const [step, setStep] = useState<Step>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [currentQuestion, setCurrentQuestion] = useState<BankQuestion | null>(
    null
  );
  const [currentStageId, setCurrentStageId] = useState<number | null>(1);
  const [showJapanese, setShowJapanese] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    totalAnswered: 0,
    totalQuestions: 0,
  });

  const [lastTranscript, setLastTranscript] = useState("");
  const [lastChapter, setLastChapter] = useState("");
  const [stageAdvancedNote, setStageAdvancedNote] = useState("");

  // null = still checking, false = needs onboarding, true = profile already set
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNextQuestion = useCallback(async () => {
    const res = await fetch("/api/next-question");
    const data = await res.json();
    setCurrentQuestion(data.nextQuestion);
    setCurrentStageId(data.nextQuestion?.life_stage_id ?? null);
    setProgress(data.progress);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/profile");
      const data = await res.json();
      setProfileReady(!!data.profile);
      if (data.profile) loadNextQuestion();
    })();
  }, [loadNextQuestion]);

  const submitProfile = async (profile: ProfileInput) => {
    setSavingProfile(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setProfileReady(true);
      await loadNextQuestion();
    } finally {
      setSavingProfile(false);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setStep("recording");
      setRecordingSeconds(0);
      setError("");
      setStageAdvancedNote("");

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setError("마이크 접근이 거부되었습니다. 브라우저 설정을 확인해주세요.");
      setStep("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      await processAudio(blob);
    };

    mediaRecorder.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, history]);

  const processAudio = async (blob: Blob) => {
    setStep("transcribing");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok) throw new Error(transcribeData.error || "STT 실패");

      const text: string = transcribeData.text;
      setLastTranscript(text);

      setStep("generating");
      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          questionId: currentQuestion?.id,
          history,
        }),
      });
      const generateData = await generateRes.json();
      if (!generateRes.ok) throw new Error(generateData.error || "생성 실패");

      setLastChapter(generateData.chapter);
      setCurrentQuestion(generateData.nextQuestion);
      setCurrentStageId(generateData.nextQuestion?.life_stage_id ?? null);
      setProgress(generateData.progress);

      if (generateData.stageAdvanced) {
        setStageAdvancedNote("다음 생애주기로 넘어갑니다 →");
      }

      setHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: JSON.stringify(generateData) },
      ]);

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setStep("error");
    }
  };

  const statusText = (() => {
    if (step === "error") return error;
    if (step === "recording") return "녹음 중 — 편하게 이야기해보세요";
    if (step === "transcribing") return "음성을 텍스트로 변환하고 있어요…";
    if (step === "generating") return "회고록 챕터를 작성하고 있어요…";
    if (!currentQuestion) return "질문에 답할 준비가 되면 버튼을 눌러주세요";
    return "버튼을 눌러 위 질문에 답해보세요";
  })();

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 py-12 px-4">
      <header className="text-center mb-2">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <h1 className="font-serif text-3xl font-bold text-gold-light tracking-wide">
            가치
          </h1>
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
        </div>
        <p className="text-xs text-text-dim tracking-widest uppercase">
          닛케이 106개 질문으로 완성하는 나의 회고록
        </p>
      </header>

      {profileReady === null && (
        <p className="text-text-dim text-sm">불러오는 중…</p>
      )}

      {profileReady === false && (
        <OnboardingForm onComplete={submitProfile} submitting={savingProfile} />
      )}

      {profileReady === true && (
        <>
          <StageProgress
            currentStageId={currentStageId}
            totalAnswered={progress.totalAnswered}
            totalQuestions={progress.totalQuestions}
          />

          {stageAdvancedNote && (
            <p className="text-xs text-gold tracking-wide">{stageAdvancedNote}</p>
          )}

          <QuestionCard
            question={currentQuestion}
            showJapanese={showJapanese}
            onToggleJapanese={() => setShowJapanese((v) => !v)}
          />

          <RecordButton
            step={step}
            recordingSeconds={recordingSeconds}
            statusText={statusText}
            onClick={step === "recording" ? stopRecording : startRecording}
            disabled={!currentQuestion && step === "idle"}
          />

          {lastChapter && (
            <ChapterPanel
              label="방금 남긴 이야기"
              transcript={lastTranscript}
              chapter={lastChapter}
            />
          )}

          {history.length > 0 && (
            <p className="text-xs text-text-muted">
              지금까지 {Math.floor(history.length / 2)}개의 이야기를 남겼어요
            </p>
          )}
        </>
      )}
    </main>
  );
}
