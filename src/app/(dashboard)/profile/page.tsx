/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useAuth } from '@/providers/auth-provider';
import { EmployeeDetailView } from '../employees/[id]/page';

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  const userId = (user as any).id;
  const userType = user._type === 'admin' ? 'admin' : 'employee';
  return <EmployeeDetailView employeeId={userId} targetType={userType} isSelfProfile />;
}
