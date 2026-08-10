import { useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Camera,
  Check,
  Clock,
  Image as ImageIcon,
  KeyRound,
  Languages,
  LoaderCircle,
  Pencil,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
import { cn } from '@/lib/utils'
import {
  changeEmail,
  changePassword,
  checkUsername,
  removeAvatar,
  setLanguage,
  setPreferredNode,
  updateDescription,
  updateUsername,
  uploadAvatar,
  useAccountContext,
} from '@/lib/account'
import {
  createImage,
  deleteImage,
  importImageUrl,
} from '@/lib/images-user'
import { useAuthConfig } from '@/lib/auth-config'

export const Route = createFileRoute('/_app/account')({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  component: AccountPage,
})

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'images', label: 'My Images', icon: ImageIcon },
  { id: 'history', label: 'Login History', icon: Clock },
] as const

function AccountPage() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const active = tab === 'images' || tab === 'history' ? tab : 'profile'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Account</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your profile, images, and security settings.
        </p>
      </div>

      <div role="tablist" aria-label="Account sections" className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => void navigate({ search: { tab: t.id } })}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors',
              active === t.id
                ? 'border-transparent bg-accent font-medium text-accent-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {active === 'profile' ? <ProfileTab /> : null}
      {active === 'images' ? <ImagesTab /> : null}
      {active === 'history' ? <HistoryTab /> : null}
    </div>
  )
}

/* ── Profile tab ─────────────────────────────────────────────────────────── */

function ProfileTab() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const context = useAccountContext()
  const user = context.data?.user
  const nodes = context.data?.nodes ?? []

  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [description, setDescription] = useState('')
  const [username, setUsername] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Hydrate form state once the context arrives.
  const seeded = useRef(false)
  if (context.data && !seeded.current) {
    seeded.current = true
    setDescription(context.data.user.description ?? '')
    setUsername(context.data.user.username ?? '')
    setEmail(context.data.user.email ?? '')
  }

  const run = async (key: string, fn: () => Promise<void>, success: string) => {
    setBusy(key)
    try {
      await fn()
      toast.success(success)
      void queryClient.invalidateQueries({ queryKey: ['account-context'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Request failed.')
    } finally {
      setBusy(null)
    }
  }

  async function onUsernameBlur(): Promise<void> {
    if (!username || username === user?.username) {
      setUsernameAvailable(null)
      return
    }
    try {
      setUsernameAvailable(!(await checkUsername(username)))
    } catch {
      setUsernameAvailable(null)
    }
  }

  async function onUploadAvatar(file: File | undefined): Promise<void> {
    if (!file || !csrf) return
    setBusy('avatar')
    try {
      const path = await uploadAvatar(file, csrf)
      toast.success('Avatar updated.')
      void queryClient.invalidateQueries({ queryKey: ['account-context'] })
      void queryClient.invalidateQueries({ queryKey: ['auth-config'] })
      if (path) window.location.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload avatar.')
    } finally {
      setBusy(null)
    }
  }

  if (!context.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading account...
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your public identity on the panel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  className="size-16 rounded-full border object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-full border bg-muted">
                  <User className="size-7 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 rounded-full border bg-background p-1.5 shadow-sm transition-colors hover:bg-muted"
                title="Upload avatar"
              >
                <Camera className="size-3.5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onUploadAvatar(e.target.files?.[0])}
              />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{user?.username}</p>
              <p className="text-xs text-muted-foreground">
                {user?.isAdmin ? 'Administrator' : 'Member'} · joined{' '}
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''}
              </p>
              <div className="mt-1 flex gap-2">
                <Badge variant="secondary">{user?.totpEnabled ? '2FA on' : '2FA off'}</Badge>
                <Link
                  to="/account/2fa/setup"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ShieldCheck className="size-3" />
                  {user?.totpEnabled ? 'Manage 2FA' : 'Enable 2FA'}
                </Link>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="acct-description">Description</Label>
            <div className="flex gap-2">
              <Input
                id="acct-description"
                maxLength={255}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell people a little about yourself"
              />
              <Button
                size="sm"
                disabled={busy === 'description'}
                onClick={() =>
                  void run(
                    'description',
                    () => updateDescription(description, csrf),
                    'Description updated.',
                  )
                }
              >
                {busy === 'description' ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save
              </Button>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="acct-username">Username</Label>
            <div className="flex gap-2">
              <Input
                id="acct-username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setUsernameAvailable(null)
                }}
                onBlur={() => void onUsernameBlur()}
                placeholder="3–32 letters, numbers, _ or -"
              />
              <Button
                size="sm"
                disabled={busy === 'username' || usernameAvailable === false}
                onClick={() =>
                  void run(
                    'username',
                    () => updateUsername(username, csrf),
                    'Username updated.',
                  )
                }
              >
                {busy === 'username' ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save
              </Button>
            </div>
            {usernameAvailable === false ? (
              <p className="text-xs text-destructive">That username is already taken.</p>
            ) : null}
            {usernameAvailable === true ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Username is available.</p>
            ) : null}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="acct-email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="acct-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy === 'email'}
                onClick={() =>
                  void run('email', () => changeEmail(email, csrf), 'Email updated.')
                }
              >
                {busy === 'email' ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save
              </Button>
            </div>
          </div>

          {/* Avatar actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy === 'remove-avatar' || !user?.avatar}
              onClick={() =>
                void run('remove-avatar', () => removeAvatar(csrf), 'Avatar removed.')
              }
            >
              <Trash2 className="size-3" />
              Remove avatar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              Password
            </CardTitle>
            <CardDescription>Use a strong, unique password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="acct-current">Current password</Label>
              <Input
                id="acct-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="acct-new">New password</Label>
                <Input
                  id="acct-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acct-confirm">Confirm new password</Label>
                <Input
                  id="acct-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button
              disabled={
                busy === 'password' ||
                !currentPassword ||
                !newPassword ||
                newPassword !== confirmPassword
              }
              onClick={() =>
                void run(
                  'password',
                  () => changePassword(currentPassword, newPassword, csrf),
                  'Password changed.',
                )
              }
            >
              {busy === 'password' ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Change password
            </Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Where new servers land, and your language</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="acct-node">Preferred node</Label>
              <select
                id="acct-node"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={user?.preferredNodeId ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null
                  void run(
                    'node',
                    () => setPreferredNode(val, csrf),
                    val ? 'Preferred node saved.' : 'Preferred node cleared.',
                  )
                }}
              >
                <option value="">Auto (least loaded)</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} — {n.address}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-lang">Language</Label>
              <div className="flex gap-2">
                <select
                  id="acct-lang"
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                  defaultValue="en"
                  onChange={(e) =>
                    void run('lang', () => setLanguage(e.target.value, csrf), 'Language preference saved.')
                  }
                >
                  {['en', 'fr', 'de', 'es', 'pt', 'it', 'ru', 'zh', 'ja', 'ta'].map((l) => (
                    <option key={l} value={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" size="icon" disabled>
                  <Languages className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ── My Images tab ───────────────────────────────────────────────────────── */

function ImagesTab() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const context = useAccountContext()

  const images = context.data?.images ?? []
  const allowed = context.data?.allowed ?? false

  const [name, setName] = useState('')
  const [startup, setStartup] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [dockerImages, setDockerImages] = useState('')
  const [variables, setVariables] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function submitManual(): Promise<void> {
    if (!csrf || !name.trim() || !startup.trim()) {
      toast.error('Name and startup command are required.')
      return
    }
    setBusy('create')
    try {
      await createImage(
        {
          name: name.trim(),
          startup: startup.trim(),
          description,
          author,
          dockerImages,
          variables,
        },
        csrf,
      )
      toast.success('Image submitted for review.')
      setName(''); setStartup(''); setDescription(''); setAuthor(''); setDockerImages(''); setVariables('')
      void queryClient.invalidateQueries({ queryKey: ['account-context'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit image.')
    } finally {
      setBusy(null)
    }
  }

  async function submitImport(): Promise<void> {
    if (!csrf || !importUrl.trim()) {
      toast.error('A URL is required.')
      return
    }
    setBusy('import')
    try {
      await importImageUrl(importUrl.trim(), csrf)
      toast.success('Image imported and submitted for review.')
      setImportUrl('')
      void queryClient.invalidateQueries({ queryKey: ['account-context'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to import image.')
    } finally {
      setBusy(null)
    }
  }

  async function removeImage(id: number, imageName: string): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Delete "${imageName}"? This cannot be undone.`)) return
    setBusy(`del-${id}`)
    try {
      await deleteImage(id, csrf)
      toast.success('Image deleted.')
      void queryClient.invalidateQueries({ queryKey: ['account-context'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete image.')
    } finally {
      setBusy(null)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      approved: { label: 'Approved', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
      pending: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
      rejected: { label: 'Rejected', cls: 'bg-destructive/10 text-destructive' },
    }
    const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' }
    return (
      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
    )
  }

  return (
    <div className="space-y-6">
      {allowed ? (
        <Card>
          <CardHeader>
            <CardTitle>Submit a new image</CardTitle>
            <CardDescription>
              Paste a Pterodactyl egg, or import one from a URL. Submissions are reviewed by an
              admin before they appear in the server-creation list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="img-name">Name *</Label>
                <Input id="img-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="img-author">Author</Label>
                <Input id="img-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-startup">Startup command *</Label>
              <Input
                id="img-startup"
                value={startup}
                onChange={(e) => setStartup(e.target.value)}
                placeholder="java -Xms{{MEMORY}}M -Xmx{{MEMORY}}M -jar {{SERVER_JARFILE}}"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-desc">Description</Label>
              <Input id="img-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="img-docker">Docker images (JSON)</Label>
                <Input
                  id="img-docker"
                  value={dockerImages}
                  onChange={(e) => setDockerImages(e.target.value)}
                  placeholder='[{"Vanilla": "ghcr.io/..."}]'
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="img-vars">Variables (JSON)</Label>
                <Input
                  id="img-vars"
                  value={variables}
                  onChange={(e) => setVariables(e.target.value)}
                  placeholder='[{"name": "Version", "env_variable": "MC_VERSION"}]'
                />
              </div>
            </div>
            <Button disabled={busy === 'create'} onClick={() => void submitManual()}>
              {busy === 'create' ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Submit for review
            </Button>

            <div className="border-t pt-4">
              <Label htmlFor="img-import">Or import from a Pterodactyl egg URL</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="img-import"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/.../egg.json"
                />
                <Button
                  variant="secondary"
                  disabled={busy === 'import'}
                  onClick={() => void submitImport()}
                >
                  {busy === 'import' ? <LoaderCircle className="size-4 animate-spin" /> : <Server className="size-4" />}
                  Import
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Image submissions are not enabled on this panel.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My submitted images</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {images.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              You haven't submitted any images yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {images.map((img) => (
                <li key={img.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{img.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(img.createdAt).toLocaleDateString()}
                    </p>
                    {img.status === 'rejected' && img.rejectionReason ? (
                      <p className="mt-0.5 text-xs text-destructive">{img.rejectionReason}</p>
                    ) : null}
                  </div>
                  {statusBadge(img.status)}
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      render={<Link to="/my-images/edit/$id" params={{ id: String(img.id) }} />}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === `del-${img.id}`}
                      onClick={() => void removeImage(img.id, img.name)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ── Login History tab ───────────────────────────────────────────────────── */

function HistoryTab() {
  const context = useAccountContext()
  const history = context.data?.loginHistory ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login history</CardTitle>
        <CardDescription>Your last 10 sign-ins</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {context.isLoading ? (
          <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            No login history yet.
          </p>
        ) : (
          <ul className="divide-y border-t">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="text-sm font-medium">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {entry.ipAddress ?? 'Unknown IP'}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {entry.userAgent ?? ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
