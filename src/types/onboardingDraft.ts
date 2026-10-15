export interface OnboardingDraft {
  responses: Record<string, string>;
  blockIndex: number;
  showIntro: boolean;
  showAiTransition: boolean;
  followUpUsed: Record<string, boolean>;
  attemptCount: Record<string, number>;
}
