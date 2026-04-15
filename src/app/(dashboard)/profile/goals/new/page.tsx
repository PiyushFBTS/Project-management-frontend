'use client';

import { GoalEditor } from '@/components/goals/goal-editor';

export default function NewSelfGoalPage() {
  return <GoalEditor context={{ kind: 'self' }} />;
}
