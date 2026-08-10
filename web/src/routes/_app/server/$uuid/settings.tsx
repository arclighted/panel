import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AlertTriangle, LoaderCircle, RotateCcw, Save, Trash2 } from 'lucide-react'

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
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthConfig } from '@/lib/auth-config'
import {
  useSettingsTab,
  updateServerSettings,
  deleteServerSelf,
  deleteServerAdmin,
  reinstallServer,
} from '@/lib/server-tabs'

export const Route = createFileRoute('/_app/server/$uuid/settings')({
  component: ServerSettingsPage,
})

function formatLimit(value: number, unit: 'GB' | 'MB' | 'cores'): string {
  if (value === 0) return 'Unlimited'
  if (unit === 'MB' && value >= 1024) return `${(value / 1024).toFixed(1)} GB`
  if (unit === 'MB') return `${value} MB`
  if (unit === 'cores') return `${(value / 100).toFixed(1)} cores`
  return `${value} ${unit}`
}

function ServerSettingsPage() {
  const { uuid } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const router = useRouter()
  const { data, isLoading, error } = useSettingsTab(uuid)

  const [name, setName] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<'delete' | 'reinstall' | 'wipe' | null>(null)
  const [working, setWorking] = useState(false)

  const server = data?.server
  const nameValue = name ?? server?.name ?? ''
  const descriptionValue = description ?? server?.description ?? ''

  const handleSave = async () => {
    if (!csrf || !server) return
    setSaving(true)
    try {
      await updateServerSettings(uuid, { name: nameValue, description: descriptionValue }, csrf)
      toast.success('Server settings saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update server settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!csrf || !server) return
    setWorking(true)
    try {
      if (data?.isAdmin) {
        await deleteServerAdmin(server.id, csrf)
      } else {
        await deleteServerSelf(uuid, csrf)
      }
      toast.success('Server deleted.')
      void router.navigate({ to: '/' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the server.")
    } finally {
      setWorking(false)
      setConfirm(null)
    }
  }

  const handleReinstall = async (preserveData: boolean) => {
    if (!csrf) return
    setWorking(true)
    try {
      await reinstallServer(uuid, preserveData, csrf)
      toast.success(
        preserveData
          ? 'Server reinstalling. This may take a while.'
          : 'Server reinstalling. All data was deleted.',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reinstall server.')
    } finally {
      setWorking(false)
      setConfirm(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading settings...
      </div>
    )
  }

  if (error || !server) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load settings.'}
      </p>
    )
  }

  const showDelete = data?.isAdmin || data?.allowUserDeleteServer

  return (
    <div className="space-y-5">
      {/* Basic settings */}
      <Card>
        <CardHeader>
          <CardTitle>Server Settings</CardTitle>
          <CardDescription>Configure your server's basic settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              void handleSave()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="serverName">Server Name</Label>
              <Input
                id="serverName"
                value={nameValue}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serverDescription">Description</Label>
              <Input
                id="serverDescription"
                value={descriptionValue}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Server information */}
      <Card>
        <CardHeader>
          <CardTitle>Server Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Server ID</dt>
              <dd className="mt-0.5 font-mono text-sm">{server.UUID}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Created</dt>
              <dd className="mt-0.5 text-sm">{new Date(server.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Node</dt>
              <dd className="mt-0.5 text-sm">{server.nodeName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Image</dt>
              <dd className="mt-0.5 text-sm">{server.imageName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Memory</dt>
              <dd className="mt-0.5 text-sm">{formatLimit(server.memory, 'MB')}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">CPU</dt>
              <dd className="mt-0.5 text-sm">{formatLimit(server.cpu, 'cores')}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Storage</dt>
              <dd className="mt-0.5 text-sm">{formatLimit(server.storage, 'MB')}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <Badge variant={server.suspended ? 'destructive' : 'outline'}>
                  {server.suspended ? 'Suspended' : 'Active'}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <h2 className="text-lg font-semibold">Danger Zone</h2>

        {showDelete ? (
          <div className="mt-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Delete Server</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this server and all its data.
              </p>
            </div>
            <Button
              variant="destructive"
              className="shrink-0"
              onClick={() => setConfirm('delete')}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Reinstall Server</h3>
            <p className="text-sm text-muted-foreground">
              Re-run the install scripts. Your files, worlds and settings are kept.
            </p>
          </div>
          <Button variant="destructive" className="shrink-0" onClick={() => setConfirm('reinstall')}>
            <RotateCcw className="size-4" />
            Reinstall
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Reinstall &amp; Delete All Data</h3>
            <p className="text-sm text-muted-foreground">
              Wipes the server volume (worlds, configs, files) then reinstalls from scratch. This cannot be undone.
            </p>
          </div>
          <Button variant="destructive" className="shrink-0" onClick={() => setConfirm('wipe')}>
            <AlertTriangle className="size-4" />
            Reinstall &amp; Delete All Data
          </Button>
        </div>
      </div>

      {/* Confirm dialogs */}
      <Dialog open={confirm === 'delete'} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Server</DialogTitle>
            <DialogDescription>
              This will permanently delete the server and all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={working} onClick={() => void handleDelete()}>
              {working ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirm === 'reinstall'} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Reinstallation</DialogTitle>
            <DialogDescription>
              Re-run the install scripts. Your files, worlds and settings are kept. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button disabled={working} onClick={() => void handleReinstall(true)}>
              {working ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Reinstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirm === 'wipe'} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reinstall &amp; Delete All Data</DialogTitle>
            <DialogDescription>
              This wipes the server volume (worlds, configs, files) and reinstalls from scratch.
              There is no recovery. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={working} onClick={() => void handleReinstall(false)}>
              {working ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Yes, Delete All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
