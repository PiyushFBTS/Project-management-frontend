'use client';

import { useParams } from 'next/navigation';
import { GoalEditor } from '@/components/goals/goal-editor';

export default function EditEmployeeGoalPage() {
  const { id, goalId } = useParams<{ id: string; goalId: string }>();
  return (
    <GoalEditor
      context={{ kind: 'employee', employeeId: Number(id) }}
      goalId={Number(goalId)}
    />
  );
}
