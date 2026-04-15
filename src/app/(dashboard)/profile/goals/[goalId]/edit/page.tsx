'use client';

import { useParams } from 'next/navigation';
import { GoalEditor } from '@/components/goals/goal-editor';

export default function EditSelfGoalPage() {
  const { goalId } = useParams<{ goalId: string }>();
  return <GoalEditor context={{ kind: 'self' }} goalId={Number(goalId)} />;
}
