export type OnboardingMessageVariant = 'A' | 'B';

// Stage 1 is the introduction; stages 2–7 follow OPEN_QUESTIONS order.
export const onboardingMessageAssets: Record<number, Record<OnboardingMessageVariant, number>> = {
  1: {
    A: require('../../assets/lumio-onboarding/Onboarding 1 (A).png'),
    B: require('../../assets/lumio-onboarding/Onboarding 1 (B).png'),
  },
  2: {
    A: require('../../assets/lumio-onboarding/Onboarding 2 (A).png'),
    B: require('../../assets/lumio-onboarding/Onboarding 2 (B).png'),
  },
  3: {
    A: require('../../assets/lumio-onboarding/Onboarding 3 (A).png'),
    B: require('../../assets/lumio-onboarding/Onboarding 3 (B).png'),
  },
  4: {
    A: require('../../assets/lumio-onboarding/Onboarding 4 (A).png'),
    B: require('../../assets/lumio-onboarding/Onboarding 4 (B).png'),
  },
  5: {
    A: require('../../assets/lumio-onboarding/Onboarding 5 (A).png'),
    B: require('../../assets/lumio-onboarding/Onboarding 5 (B).png'),
  },
  6: {
    A: require('../../assets/lumio-onboarding/Onboarding 6 (A).png'),
    B: require('../../assets/lumio-onboarding/Onboarding 6 (B).png'),
  },
  7: {
    A: require('../../assets/lumio-onboarding/Onboarding 7 (A).png'),
    B: require('../../assets/lumio-onboarding/Onboarding 7 (B).png'),
  },
};
