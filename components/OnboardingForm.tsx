"use client";

import { useState } from "react";

export interface ProfileInput {
  gender: "male" | "female" | "unspecified";
  maritalStatus: "married" | "unmarried" | "unspecified";
  hasChildren: boolean | null;
  careerType: "corporate" | "self_employed" | "homemaker" | "farmer" | "other";
  birthYearRange: string;
}

interface Props {
  onComplete: (profile: ProfileInput) => void;
  submitting: boolean;
}

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-text-dim tracking-wide">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2.5 rounded-xl text-sm border transition-colors ${
              value === opt.value
                ? "bg-gold text-bg border-gold font-medium"
                : "bg-transparent text-text-dim border-border hover:border-gold-dim"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingForm({ onComplete, submitting }: Props) {
  const [gender, setGender] = useState<ProfileInput["gender"]>("unspecified");
  const [maritalStatus, setMaritalStatus] =
    useState<ProfileInput["maritalStatus"]>("unspecified");
  const [hasChildrenChoice, setHasChildrenChoice] = useState<
    "yes" | "no" | "unspecified"
  >("unspecified");
  const [careerType, setCareerType] =
    useState<ProfileInput["careerType"]>("other");
  const [birthYearRange, setBirthYearRange] = useState("1950s");

  const submit = () => {
    onComplete({
      gender,
      maritalStatus,
      hasChildren:
        hasChildrenChoice === "unspecified" ? null : hasChildrenChoice === "yes",
      careerType,
      birthYearRange,
    });
  };

  return (
    <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-7 flex flex-col gap-6">
      <div>
        <p className="font-serif text-gold-light text-lg mb-1">
          시작하기 전에 몇 가지만 여쭤볼게요
        </p>
        <p className="text-text-dim text-xs leading-relaxed">
          답변에 맞춰 더 어울리는 질문을 골라드리기 위해 사용해요. 원하지 않으시면
          &ldquo;응답 안 함&rdquo;을 선택하셔도 괜찮아요.
        </p>
      </div>

      <OptionGroup
        label="성별"
        value={gender}
        onChange={setGender}
        options={[
          { value: "male", label: "남성" },
          { value: "female", label: "여성" },
          { value: "unspecified", label: "응답 안 함" },
        ]}
      />

      <OptionGroup
        label="결혼 여부"
        value={maritalStatus}
        onChange={setMaritalStatus}
        options={[
          { value: "married", label: "기혼" },
          { value: "unmarried", label: "미혼" },
          { value: "unspecified", label: "응답 안 함" },
        ]}
      />

      <OptionGroup
        label="자녀 유무"
        value={hasChildrenChoice}
        onChange={setHasChildrenChoice}
        options={[
          { value: "yes", label: "있음" },
          { value: "no", label: "없음" },
          { value: "unspecified", label: "응답 안 함" },
        ]}
      />

      <OptionGroup
        label="주된 사회생활 형태"
        value={careerType}
        onChange={setCareerType}
        options={[
          { value: "corporate", label: "회사원" },
          { value: "self_employed", label: "자영업" },
          { value: "homemaker", label: "가정주부" },
          { value: "farmer", label: "농업" },
          { value: "other", label: "기타" },
        ]}
      />

      <OptionGroup
        label="태어난 시기"
        value={birthYearRange}
        onChange={setBirthYearRange}
        options={[
          { value: "1930s", label: "1930년대 이전" },
          { value: "1940s", label: "1940년대" },
          { value: "1950s", label: "1950년대" },
          { value: "1960s", label: "1960년대" },
          { value: "1970s", label: "1970년대 이후" },
        ]}
      />

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-3.5 rounded-xl bg-gold text-bg font-medium text-base
                   hover:bg-gold-light transition-colors disabled:opacity-50"
      >
        {submitting ? "시작하는 중…" : "시작하기"}
      </button>
    </div>
  );
}
