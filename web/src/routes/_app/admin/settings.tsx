import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { LoaderCircle, Save, Shield, Sliders, Mail, Cloud, Hammer, Settings as SettingsIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthConfig } from '@/lib/auth-config'
import {
  banIp,
  saveGeneralSettings,
  saveS3Settings,
  saveSecuritySettings,
  saveServerPolicy,
  saveSmtpSettings,
  testSmtp,
  unbanIp,
  useAdminPage,
} from '@/lib/admin'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/settings')({
  component: AdminSettingsPage,
})

interface SettingsData {
  settings: Record<string, unknown>
  allThemes: { name: string; path: string | null; builtin: boolean }[]
}

const TABS = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'policy', label: 'Server policy', icon: Hammer },
  { id: 'smtp', label: 'SMTP', icon: Mail },
  { id: 's3', label: 'S3 backups', icon: Cloud },
] as const

function AdminSettingsPage() {
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<SettingsData>('settings')
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('general')
  const [saving, setSaving] = useState(false)

  const [general, setGeneral] = useState({ allowRegistration: false, uploadLimit: '100', virusTotalApiKey: '' })
  const [security, setSecurity] = useState({
    rateLimitEnabled: false, rateLimitRpm: '120', loginMaxAttempts: '5', loginLockoutMinutes: '15',
    enforceDaemonHttps: false, require2faForAdmins: false, behindReverseProxy: false, hashApiKeys: false,
  })
  const [policy, setPolicy] = useState({
    allowUserCreateServer: false, allowUserDeleteServer: false, allowUserCreateImages: false,
    onboardingEnabled: true, defaultServerLimit: '5', defaultMaxMemory: '512', defaultMaxCpu: '100',
    defaultMaxStorage: '5120', defaultMaxDatabases: '5', defaultOverallocateMemory: '0',
    defaultOverallocateDisk: '0', defaultOverallocateCpu: '0',
  })
  const [smtp, setSmtp] = useState({
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPassword: '', smtpFrom: '', smtpSecure: false,
  })
  const [s3, setS3] = useState({
    s3Enabled: false, s3Endpoint: '', s3Region: '', s3Bucket: '', s3AccessKey: '', s3SecretKey: '', s3PathStyle: false,
  })
  const [banTarget, setBanTarget] = useState('')

  useEffect(() => {
    if (!page.data) return
    const s = page.data.settings
    setGeneral({
      allowRegistration: s.allowRegistration === true,
      uploadLimit: String(s.uploadLimit ?? 100),
      virusTotalApiKey: typeof s.virusTotalApiKey === 'string' ? s.virusTotalApiKey : '',
    })
    setSecurity({
      rateLimitEnabled: s.rateLimitEnabled === true,
      rateLimitRpm: String(s.rateLimitRpm ?? 120),
      loginMaxAttempts: String(s.loginMaxAttempts ?? 5),
      loginLockoutMinutes: String(s.loginLockoutMinutes ?? 15),
      enforceDaemonHttps: s.enforceDaemonHttps === true,
      require2faForAdmins: s.require2faForAdmins === true,
      behindReverseProxy: s.behindReverseProxy === true,
      hashApiKeys: s.hashApiKeys === true,
    })
    setPolicy({
      allowUserCreateServer: s.allowUserCreateServer === true,
      allowUserDeleteServer: s.allowUserDeleteServer === true,
      allowUserCreateImages: s.allowUserCreateImages === true,
      onboardingEnabled: s.onboardingEnabled !== false,
      defaultServerLimit: String(s.defaultServerLimit ?? 5),
      defaultMaxMemory: String(s.defaultMaxMemory ?? 512),
      defaultMaxCpu: String(s.defaultMaxCpu ?? 100),
      defaultMaxStorage: String(s.defaultMaxStorage ?? 5120),
      defaultMaxDatabases: String(s.defaultMaxDatabases ?? 5),
      defaultOverallocateMemory: String(s.defaultOverallocateMemory ?? 0),
      defaultOverallocateDisk: String(s.defaultOverallocateDisk ?? 0),
      defaultOverallocateCpu: String(s.defaultOverallocateCpu ?? 0),
    })
    setSmtp({
      smtpHost: typeof s.smtpHost === 'string' ? s.smtpHost : '',
      smtpPort: String(s.smtpPort ?? 587),
      smtpUser: typeof s.smtpUser === 'string' ? s.smtpUser : '',
      smtpPassword: '',
      smtpFrom: typeof s.smtpFrom === 'string' ? s.smtpFrom : '',
      smtpSecure: s.smtpSecure === true,
    })
    setS3({
      s3Enabled: s.s3Enabled === true,
      s3Endpoint: typeof s.s3Endpoint === 'string' ? s.s3Endpoint : '',
      s3Region: typeof s.s3Region === 'string' ? s.s3Region : '',
      s3Bucket: typeof s.s3Bucket === 'string' ? s.s3Bucket : '',
      s3AccessKey: typeof s.s3AccessKey === 'string' ? s.s3AccessKey : '',
      s3SecretKey: '',
      s3PathStyle: s.s3PathStyle === true,
    })
  }, [page.data])

  async function saveCurrent(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      if (tab === 'general') await saveGeneralSettings(general, csrf)
      if (tab === 'security') await saveSecuritySettings(security, csrf)
      if (tab === 'policy') await saveServerPolicy(policy, csrf)
      if (tab === 'smtp') await saveSmtpSettings(smtp, csrf)
      if (tab === 's3') await saveS3Settings(s3, csrf)
      toast.success('Settings saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function doTest(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      if (tab === 'smtp') {
        await testSmtp({}, csrf)
        toast.success('SMTP connection verified.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed.')
    } finally {
      setSaving(false)
    }
  }

  async function doBan(): Promise<void> {
    if (!csrf || !banTarget.trim()) return
    try {
      await banIp({ ip: banTarget.trim() }, csrf)
      toast.success('IP banned.')
      setBanTarget('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to ban IP.')
    }
  }

  const bool = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="size-4" />
      {label}
    </label>
  )

  const numInput = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )

  const textInput = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string,
    type = 'text',
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading settings...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <SettingsIcon className="size-5" />
            Settings
          </h1>
        </div>
        <Button disabled={saving} onClick={() => void saveCurrent()}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
      </div>

      <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors',
              tab === t.id
                ? 'border-transparent bg-accent font-medium text-accent-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Registration, uploads, and VirusTotal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bool('Allow new registrations', general.allowRegistration, (v) => setGeneral((s) => ({ ...s, allowRegistration: v })))}
            {numInput('st-upload', 'Upload limit (MB)', general.uploadLimit, (v) => setGeneral((s) => ({ ...s, uploadLimit: v })))}
            {textInput('st-vt', 'VirusTotal API key', general.virusTotalApiKey, (v) => setGeneral((s) => ({ ...s, virusTotalApiKey: v })), 'Optional — enables malware scanning')}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'security' ? (
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Rate limits, 2FA enforcement, and IP bans</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bool('Enable rate limiting', security.rateLimitEnabled, (v) => setSecurity((s) => ({ ...s, rateLimitEnabled: v })))}
            <div className="grid gap-3 sm:grid-cols-3">
              {numInput('st-rpm', 'Rate limit (requests/min)', security.rateLimitRpm, (v) => setSecurity((s) => ({ ...s, rateLimitRpm: v })))}
              {numInput('st-attempts', 'Max login attempts', security.loginMaxAttempts, (v) => setSecurity((s) => ({ ...s, loginMaxAttempts: v })))}
              {numInput('st-lockout', 'Lockout (minutes)', security.loginLockoutMinutes, (v) => setSecurity((s) => ({ ...s, loginLockoutMinutes: v })))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {bool('Require 2FA for admins', security.require2faForAdmins, (v) => setSecurity((s) => ({ ...s, require2faForAdmins: v })))}
              {bool('Enforce HTTPS on daemons', security.enforceDaemonHttps, (v) => setSecurity((s) => ({ ...s, enforceDaemonHttps: v })))}
              {bool('Behind a reverse proxy', security.behindReverseProxy, (v) => setSecurity((s) => ({ ...s, behindReverseProxy: v })))}
              {bool('Hash API keys at rest', security.hashApiKeys, (v) => setSecurity((s) => ({ ...s, hashApiKeys: v })))}
            </div>
            <div className="border-t pt-4">
              <div className="flex gap-2">
                {textInput('st-ban', 'Ban an IP', banTarget, setBanTarget, '1.2.3.4')}
                <Button variant="destructive" className="mt-5" onClick={() => void doBan()}>
                  Ban
                </Button>
                <Button
                  variant="secondary"
                  className="mt-5"
                  onClick={() => {
                    if (!banTarget.trim()) return
                    void unbanIp({ ip: banTarget.trim() }, csrf).then(() => {
                      toast.success('IP unbanned.')
                      setBanTarget('')
                    }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to unban IP.'))
                  }}
                >
                  Unban
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'policy' ? (
        <Card>
          <CardHeader>
            <CardTitle>Server policy</CardTitle>
            <CardDescription>Defaults for newly registered users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {bool('Allow users to create servers', policy.allowUserCreateServer, (v) => setPolicy((s) => ({ ...s, allowUserCreateServer: v })))}
              {bool('Allow users to delete servers', policy.allowUserDeleteServer, (v) => setPolicy((s) => ({ ...s, allowUserDeleteServer: v })))}
              {bool('Allow users to submit images', policy.allowUserCreateImages, (v) => setPolicy((s) => ({ ...s, allowUserCreateImages: v })))}
              {bool('Onboarding for new users', policy.onboardingEnabled, (v) => setPolicy((s) => ({ ...s, onboardingEnabled: v })))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {numInput('sp-limit', 'Default server limit', policy.defaultServerLimit, (v) => setPolicy((s) => ({ ...s, defaultServerLimit: v })))}
              {numInput('sp-memory', 'Default max memory (MB)', policy.defaultMaxMemory, (v) => setPolicy((s) => ({ ...s, defaultMaxMemory: v })))}
              {numInput('sp-cpu', 'Default max CPU (%)', policy.defaultMaxCpu, (v) => setPolicy((s) => ({ ...s, defaultMaxCpu: v })))}
              {numInput('sp-storage', 'Default max storage (MB)', policy.defaultMaxStorage, (v) => setPolicy((s) => ({ ...s, defaultMaxStorage: v })))}
              {numInput('sp-databases', 'Default max databases', policy.defaultMaxDatabases, (v) => setPolicy((s) => ({ ...s, defaultMaxDatabases: v })))}
              {numInput('sp-over-mem', 'Default RAM overalloc (%)', policy.defaultOverallocateMemory, (v) => setPolicy((s) => ({ ...s, defaultOverallocateMemory: v })))}
              {numInput('sp-over-disk', 'Default disk overalloc (%)', policy.defaultOverallocateDisk, (v) => setPolicy((s) => ({ ...s, defaultOverallocateDisk: v })))}
              {numInput('sp-over-cpu', 'Default CPU overalloc (%)', policy.defaultOverallocateCpu, (v) => setPolicy((s) => ({ ...s, defaultOverallocateCpu: v })))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'smtp' ? (
        <Card>
          <CardHeader>
            <CardTitle>SMTP</CardTitle>
            <CardDescription>Outbound email for password resets and notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {textInput('st-smtp-host', 'Host', smtp.smtpHost, (v) => setSmtp((s) => ({ ...s, smtpHost: v })), 'smtp.example.com')}
              {numInput('st-smtp-port', 'Port', smtp.smtpPort, (v) => setSmtp((s) => ({ ...s, smtpPort: v })))}
              {textInput('st-smtp-user', 'Username', smtp.smtpUser, (v) => setSmtp((s) => ({ ...s, smtpUser: v })))}
              {textInput('st-smtp-pass', 'Password', smtp.smtpPassword, (v) => setSmtp((s) => ({ ...s, smtpPassword: v })), 'Leave blank to keep', 'password')}
              {textInput('st-smtp-from', 'From address', smtp.smtpFrom, (v) => setSmtp((s) => ({ ...s, smtpFrom: v })), 'no-reply@example.com')}
            </div>
            {bool('Use TLS/SSL', smtp.smtpSecure, (v) => setSmtp((s) => ({ ...s, smtpSecure: v })))}
            <Button variant="secondary" disabled={saving} onClick={() => void doTest()}>
              Test connection
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === 's3' ? (
        <Card>
          <CardHeader>
            <CardTitle>S3 backups</CardTitle>
            <CardDescription>Store server backups in an S3-compatible bucket</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bool('Enable S3 backups', s3.s3Enabled, (v) => setS3((s) => ({ ...s, s3Enabled: v })))}
            <div className="grid gap-3 sm:grid-cols-2">
              {textInput('st-s3-endpoint', 'Endpoint', s3.s3Endpoint, (v) => setS3((s) => ({ ...s, s3Endpoint: v })), 'https://s3.example.com')}
              {textInput('st-s3-region', 'Region', s3.s3Region, (v) => setS3((s) => ({ ...s, s3Region: v })), 'us-east-1')}
              {textInput('st-s3-bucket', 'Bucket', s3.s3Bucket, (v) => setS3((s) => ({ ...s, s3Bucket: v })))}
              {textInput('st-s3-key', 'Access key', s3.s3AccessKey, (v) => setS3((s) => ({ ...s, s3AccessKey: v })))}
              {textInput('st-s3-secret', 'Secret key', s3.s3SecretKey, (v) => setS3((s) => ({ ...s, s3SecretKey: v })), 'Leave blank to keep', 'password')}
            </div>
            {bool('Use path-style addressing', s3.s3PathStyle, (v) => setS3((s) => ({ ...s, s3PathStyle: v })))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
