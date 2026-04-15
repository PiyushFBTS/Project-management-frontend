'use client';

import { useParams } from 'next/navigation';
import { GoalEditor } from '@/components/goals/goal-editor';

export default function NewEmployeeGoalPage() {
  const { id } = useParams<{ id: string }>();
  return <GoalEditor context={{ kind: 'employee', employeeId: Number(id) }} />;
}
