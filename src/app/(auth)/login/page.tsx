'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, TrendingUp, ShieldCheck, BarChart3, Users } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { LoginType } from '@/lib/auth/token-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

const features = [
  { icon: BarChart3, label: 'Real-time dashboards & reports' },
  { icon: Users, label: 'Employee & project management' },
  { icon: ShieldCheck, label: 'Role-based secure access' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<LoginType>('admin');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const id = toast.loading('Signing in…');
    try {
      await login(values.email, values.password, loginType);
      toast.success('Welcome back!', { id });
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message ?? 'Login failed. Check credentials.';
      console.log("msg===>",msg);
      
      toast.error(msg, {
        id,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* ── Left panel: brand / features ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg leading-none">IT Project</p>
            <p className="text-xs text-indigo-200 mt-0.5">Management System</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Manage projects<br />with confidence.
            </h1>
            <p className="mt-3 text-indigo-200 text-base leading-relaxed">
              Track time, monitor performance, and generate insightful reports — all from one unified portal.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-indigo-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </div>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-indigo-300">&copy; 2026 IT Project Management System &middot; v3.0</p>
      </div>

      {/* ── Right panel: login form ── */}
      <div className="flex flex-1 items-center justify-center bg-background px-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile brand */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold leading-none">IT Project Mgmt</p>
              <p className="text-xs text-muted-foreground">Portal</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in as {loginType === 'admin' ? 'an admin' : loginType === 'employee' ? 'an employee' : 'a client'}
            </p>
          </div>

          {/* Login type toggle */}
          <div className="flex rounded-lg border border-border bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setLoginType('admin')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${loginType === 'admin'
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setLoginType('employee')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${loginType === 'employee'
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Employee
            </button>
            <button
              type="button"
              onClick={() => setLoginType('client')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${loginType === 'client'
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Client
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder={loginType === 'admin' ? 'admin@acme.com' : loginType === 'employee' ? 'priya.singh@acme.com' : 'client@company.com'}
                className="h-10"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-10"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 font-medium shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                `Sign In as ${loginType === 'admin' ? 'Admin' : loginType === 'employee' ? 'Employee' : 'Client'}`
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
