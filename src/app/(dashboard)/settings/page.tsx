'use client';

import { Settings, Mail } from 'lucide-react';
import { useCompany } from '@/providers/company-provider';
import { SmtpConfigForm } from '@/components/shared/smtp-config-form';
import { smtpApi } from '@/lib/api/smtp';

export default function SettingsPage() {
  const { selectedCompany, isSuperAdmin } = useCompany();

  const isPlatformView = isSuperAdmin && !selectedCompany;

  return (
    <div className="space-y-6">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-sky-600 via-blue-600 to-indigo-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
            <p className="text-sm text-white/60">{isPlatformView ? 'Platform-level configuration' : 'Company configuration'}</p>
          </div>
        </div>
      </div>

      {/* SMTP Configuration Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="h-1 -mt-6 -mx-6 mb-5 rounded-t-[inherit] bg-linear-to-r from-sky-500 via-blue-500 to-indigo-500" />
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-5 w-5 text-sky-500" />
          <h2 className="text-lg font-semibold">
            {isPlatformView ? 'Global SMTP Configuration' : 'SMTP Configuration'}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {isPlatformView
            ? 'Configure the default SMTP server used for platform-wide automated emails. Companies without their own SMTP will use this configuration.'
            : 'Configure the SMTP server for sending emails from your company. If not configured, the platform default will be used.'}
        </p>

        {isPlatformView ? (
          <SmtpConfigForm
            queryKey={['global-smtp']}
            fetchConfigs={() => smtpApi.getGlobalConfigs()}
            createConfig={(dto) => smtpApi.createGlobalConfig(dto)}
            updateConfig={(smtpId, dto) => smtpApi.updateGlobalConfig(smtpId, dto)}
            deleteConfig={(smtpId) => smtpApi.deleteGlobalConfig(smtpId)}
            testConfig={(smtpId, dto) => smtpApi.testGlobalConfig(smtpId, dto)}
            sendEmail={(smtpId, to, subject, body, files) => smtpApi.sendGlobalEmail(smtpId, to, subject, body, files)}
          />
        ) : (
          <SmtpConfigForm
            queryKey={['own-smtp']}
            fetchConfigs={() => smtpApi.getOwnConfigs()}
            createConfig={(dto) => smtpApi.createOwnConfig(dto)}
            updateConfig={(smtpId, dto) => smtpApi.updateOwnConfig(smtpId, dto)}
            deleteConfig={(smtpId) => smtpApi.deleteOwnConfig(smtpId)}
            testConfig={(smtpId, dto) => smtpApi.testOwnConfig(smtpId, dto)}
            sendEmail={(smtpId, to, subject, body, files) => smtpApi.sendOwnEmail(smtpId, to, subject, body, files)}
          />
        )}
      </div>
    </div>
  );
}
