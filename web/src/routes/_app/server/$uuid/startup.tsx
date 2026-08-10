import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { CheckCircle2, LoaderCircle, Save, XCircle } from 'lucide-react'

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
import { useAuthConfig } from '@/lib/auth-config'
import {
  useStartupTab,
  updateStartupCommand,
  updateDockerImage,
  updateStartupVariables,
  validateVariableRules,
  type StartupVariable,
} from '@/lib/server-tabs'

export const Route = createFileRoute('/_app/server/$uuid/startup')({
  component: ServerStartupPage,
})

function ServerStartupPage() {
  const { uuid } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const { data, isLoading, error } = useStartupTab(uuid)

  const [command, setCommand] = useState<string | null>(null)
  const [dockerImage, setDockerImage] = useState<string | null>(null)
  const [variables, setVariables] = useState<Record<string, string | number | boolean> | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading startup configuration...
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load startup configuration.'}
      </p>
    )
  }

  const server = data.server
  const commandValue = command ?? server.startCommand ?? ''
  const dockerValue = dockerImage ?? data.currentDockerImage
  const vars: Record<string, string | number | boolean> =
    variables ??
    Object.fromEntries(data.variables.map((v) => [v.env, v.value]))

  const saveCommand = async () => {
    if (!csrf) return
    setSaving('command')
    try {
      await updateStartupCommand(uuid, commandValue, csrf)
      toast.success('Startup command saved successfully!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save startup command')
    } finally {
      setSaving(null)
    }
  }

  const saveDockerImage = async () => {
    if (!csrf || !dockerValue) return
    setSaving('image')
    try {
      await updateDockerImage(uuid, dockerValue, csrf)
      toast.success('Docker image updated successfully! Server will be restarted if it was running.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update Docker image')
    } finally {
      setSaving(null)
    }
  }

  const saveVariables = async () => {
    if (!csrf) return
    // Client-side rule validation, mirroring the EJS + backend validateVariableRules.
    const errors: string[] = []
    const payload: StartupVariable[] = data.variables.map((v) => {
      const raw = vars[v.env]
      let value: string | number | boolean = raw
      if (v.type === 'boolean') {
        value = raw === true || raw === 'true' || raw === 1 || raw === '1' ? 1 : 0
      } else if (v.type === 'number') {
        const num = Number(raw)
        value = isNaN(num) || raw === '' ? (v.value !== '' ? v.value : v.default) : num
      } else {
        value = raw === '' || raw === undefined ? (v.value !== '' ? v.value : v.default) : String(raw)
      }
      const err = validateVariableRules(v, String(value))
      if (err) errors.push(err)
      return { ...v, value }
    })

    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }

    setSaving('variables')
    try {
      await updateStartupVariables(uuid, payload, csrf)
      toast.success('Variables saved successfully!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save variables')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Startup command */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Startup Command</CardTitle>
              <CardDescription>
                Customize the command used to start your server.
              </CardDescription>
            </div>
            <Badge variant={server.allowStartupEdit ? 'outline' : 'destructive'}>
              {server.allowStartupEdit ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <XCircle className="size-3" />
              )}
              {server.allowStartupEdit ? 'Editing Enabled' : 'Editing Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="startCommand">Startup Command</Label>
            <textarea
              id="startCommand"
              rows={3}
              readOnly={!server.allowStartupEdit}
              value={commandValue}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50"
            />
            {!server.allowStartupEdit ? (
              <p className="text-xs text-destructive">
                Startup command editing is disabled for this server. Contact an administrator to enable this feature.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Use $ALVKT(VARIABLE_NAME) to reference environment variables.
              </p>
            )}
          </div>
          <Button
            disabled={!server.allowStartupEdit || saving === 'command'}
            onClick={() => void saveCommand()}
          >
            {saving === 'command' ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Command
          </Button>
        </CardContent>
      </Card>

      {/* Docker image */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Docker Image</CardTitle>
              <CardDescription>Change the Docker image used by your server.</CardDescription>
            </div>
            <Badge>Requires Restart</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dockerImage">Docker Image</Label>
            <select
              id="dockerImage"
              value={dockerValue}
              onChange={(e) => setDockerImage(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {data.availableDockerImages.length > 0 ? (
                data.availableDockerImages.map((image) => (
                  <option key={image} value={image}>{image}</option>
                ))
              ) : (
                <option value="" disabled>No Docker images available</option>
              )}
            </select>
            <p className="text-xs text-muted-foreground">
              Changing the Docker image will restart your server if it's currently running.
            </p>
          </div>
          <Button disabled={saving === 'image'} onClick={() => void saveDockerImage()}>
            {saving === 'image' ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Update Docker Image
          </Button>
        </CardContent>
      </Card>

      {/* Server variables */}
      <Card>
        <CardHeader>
          <CardTitle>Server Variables</CardTitle>
          <CardDescription>Configure environment variables for your server.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.variables.length > 0 ? (
            data.variables.map((variable) => (
              <div
                key={variable.env}
                className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-3"
              >
                <div>
                  <Label>{variable.name}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Environment: {variable.env}</p>
                </div>
                <div className="md:col-span-2">
                  {variable.type === 'boolean' ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={vars[variable.env] === true || vars[variable.env] === 1 || vars[variable.env] === '1'}
                        onChange={(e) =>
                          setVariables({ ...vars, [variable.env]: e.target.checked })
                        }
                        className="h-4 w-4 rounded accent-primary"
                      />
                      {vars[variable.env] === true || vars[variable.env] === 1 || vars[variable.env] === '1'
                        ? 'Enabled'
                        : 'Disabled'}
                    </label>
                  ) : (
                    <Input
                      type={variable.type === 'number' ? 'number' : 'text'}
                      value={String(vars[variable.env] ?? '')}
                      onChange={(e) => {
                        const raw = e.target.value
                        setVariables({
                          ...vars,
                          [variable.env]:
                            variable.type === 'number' && raw !== '' ? Number(raw) : raw,
                        })
                      }}
                    />
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Type: {variable.type}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No variables available for this server.</p>
          )}
          {data.variables.length > 0 ? (
            <Button disabled={saving === 'variables'} onClick={() => void saveVariables()}>
              {saving === 'variables' ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Variables
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
