import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  History,
  LoaderCircle,
  Minus,
  Play,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react'

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
  useSchedulesTab,
  useScheduleActions,
  createSchedule,
  toggleSchedule,
  deleteSchedule,
  runScheduleNow,
  addScheduleTask,
  deleteScheduleTask,
  describeCron,
  validCron,
  buildGranularCron,
  type ScheduleRecord,
} from '@/lib/server-tabs'

export const Route = createFileRoute('/_app/server/$uuid/schedules')({
  component: ServerSchedulesPage,
})

const GRAN_KEYS = ['sec', 'min', 'hour', 'dom'] as const
const GRAN_LABELS: Record<string, string> = { sec: 'Seconds', min: 'Minutes', hour: 'Hours', dom: 'Day of month' }
const GRAN_LIMITS: Record<string, [number, number]> = { sec: [0, 59], min: [0, 59], hour: [0, 23], dom: [1, 31] }

function ServerSchedulesPage() {
  const { uuid } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const actions = useScheduleActions(uuid)
  const { data, isLoading, error } = useSchedulesTab(uuid)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [cron, setCron] = useState('0 0 * * * *')
  const [timeOffset, setTimeOffset] = useState('0')
  const [cronError, setCronError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ScheduleRecord | null>(null)

  const handleCreate = async () => {
    if (!csrf) return
    if (!createName.trim()) {
      toast.error('Enter a schedule name.')
      return
    }
    if (!validCron(cron)) {
      setCronError(true)
      return
    }
    setCronError(false)
    setCreating(true)
    try {
      await createSchedule(uuid, {
        name: createName.trim(),
        cron: cron.trim(),
        timeOffset: Number(timeOffset) || 0,
      }, csrf)
      toast.success('Schedule created.')
      setCreateOpen(false)
      setCreateName('')
      setCron('0 0 * * * *')
      setTimeOffset('0')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create schedule.')
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (schedule: ScheduleRecord, enabled: boolean) => {
    if (!csrf) return
    try {
      await toggleSchedule(uuid, schedule.id, enabled, csrf)
      toast.success(enabled ? 'Schedule enabled.' : 'Schedule disabled.')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update schedule.')
    }
  }

  const handleRun = async (schedule: ScheduleRecord) => {
    if (!csrf) return
    setBusyId(schedule.id)
    try {
      await runScheduleNow(uuid, schedule.id, csrf)
      toast.success('Schedule run triggered.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to run schedule.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!csrf || !confirmDelete) return
    setBusyId(confirmDelete.id)
    try {
      await deleteSchedule(uuid, confirmDelete.id, csrf)
      toast.success('Schedule deleted.')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete schedule.')
    } finally {
      setBusyId(null)
      setConfirmDelete(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading schedules...
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load schedules.'}
      </p>
    )
  }

  const { schedules } = data

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Schedules</CardTitle>
            <CardDescription>Run commands, power actions, or backups on a timer.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <Calendar className="size-12 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-medium">No schedules</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a schedule to run commands, power actions, or backups on a timer.
            </p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New Schedule
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-2/5 px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Schedule</th>
                  <th className="px-6 py-3 font-medium">Tasks</th>
                  <th className="w-24 px-6 py-3 font-medium">Enabled</th>
                  <th className="w-52 px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {schedules.map((schedule) => (
                  <ScheduleRow
                    key={schedule.id}
                    schedule={schedule}
                    expanded={expanded === schedule.id}
                    busy={busyId === schedule.id}
                    onToggleExpanded={() =>
                      setExpanded(expanded === schedule.id ? null : schedule.id)
                    }
                    onToggle={(enabled) => void handleToggle(schedule, enabled)}
                    onRun={() => void handleRun(schedule)}
                    onDelete={() => setConfirmDelete(schedule)}
                    onTaskAdded={() => actions.invalidate()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New schedule</DialogTitle>
            <DialogDescription>
              Choose a name and when it should run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="schedName">Name</Label>
              <Input
                id="schedName"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Daily restart"
                autoComplete="off"
              />
            </div>

            <CronBuilder cron={cron} onChange={setCron} error={cronError} />

            <div className="space-y-1.5">
              <Label htmlFor="schedTimeOffset">Time offset (minutes)</Label>
              <Input
                id="schedTimeOffset"
                type="number"
                min={-1440}
                max={1440}
                value={timeOffset}
                onChange={(e) => setTimeOffset(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Shift the schedule's clock forward (+) or backward (−) from the server's UTC time,
                in minutes.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button disabled={creating} onClick={() => void handleCreate()}>
              {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete schedule</DialogTitle>
            <DialogDescription>
              Delete "{confirmDelete?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busyId !== null} onClick={() => void handleDelete()}>
              {busyId !== null ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ScheduleRow({
  schedule,
  expanded,
  busy,
  onToggleExpanded,
  onToggle,
  onRun,
  onDelete,
  onTaskAdded,
}: {
  schedule: ScheduleRecord
  expanded: boolean
  busy: boolean
  onToggleExpanded: () => void
  onToggle: (enabled: boolean) => void
  onRun: () => void
  onDelete: () => void
  onTaskAdded: () => void
}) {
  const { uuid } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null

  const [taskAction, setTaskAction] = useState<'command' | 'power' | 'backup'>('command')
  const [taskCommand, setTaskCommand] = useState('')
  const [taskPower, setTaskPower] = useState('start')
  const [taskBackupName, setTaskBackupName] = useState('')
  const [taskOffset, setTaskOffset] = useState('0')
  const [adding, setAdding] = useState(false)

  const addTask = async () => {
    if (!csrf) return
    let payload: Record<string, unknown>
    if (taskAction === 'command') {
      if (!taskCommand.trim()) {
        toast.error('Command is required.')
        return
      }
      payload = { command: taskCommand.trim() }
    } else if (taskAction === 'power') {
      payload = { action: taskPower }
    } else {
      if (!taskBackupName.trim()) {
        toast.error('Backup name is required.')
        return
      }
      payload = { name: taskBackupName.trim() }
    }
    setAdding(true)
    try {
      await addScheduleTask(uuid, schedule.id, {
        action: taskAction,
        payload,
        timeOffset: Math.max(0, Number(taskOffset) || 0),
      }, csrf)
      toast.success('Task added.')
      setTaskCommand('')
      setTaskBackupName('')
      setTaskOffset('0')
      onTaskAdded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add task.')
    } finally {
      setAdding(false)
    }
  }

  const removeTask = async (taskId: number) => {
    if (!csrf) return
    try {
      await deleteScheduleTask(uuid, schedule.id, taskId, csrf)
      toast.success('Task removed.')
      onTaskAdded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove task.')
    }
  }

  return (
    <>
      <tr className="transition-colors hover:bg-muted/30">
        <td className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{schedule.name}</h3>
            {!schedule.enabled ? (
              <Badge variant="secondary">Disabled</Badge>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Next: {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : '—'}
            </span>
            <span className="flex items-center gap-1">
              <History className="size-3" />
              Last: {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : 'never'}
            </span>
          </div>
        </td>
        <td className="whitespace-nowrap px-6 py-4 align-top">
          <span
            className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-medium text-accent"
            title="Cron expression"
          >
            {schedule.cron}
          </span>
          {schedule.timeOffset ? (
            <span
              className="ml-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
              title="Schedule clock offset"
            >
              {schedule.timeOffset > 0 ? '+' : ''}{schedule.timeOffset}m
            </span>
          ) : null}
        </td>
        <td className="whitespace-nowrap px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm tabular-nums">{schedule.tasks.length}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleExpanded}
              aria-expanded={expanded}
            >
              <Settings className="size-3" />
              Manage
              <ChevronDown
                className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </Button>
          </div>
        </td>
        <td className="whitespace-nowrap px-6 py-4">
          <input
            type="checkbox"
            className="peer sr-only"
            id={`sched-toggle-${schedule.id}`}
            checked={schedule.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <label
            htmlFor={`sched-toggle-${schedule.id}`}
            className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full bg-input transition-colors peer-checked:bg-primary"
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-background shadow transition-transform ${
                schedule.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
              }`}
            />
          </label>
        </td>
        <td className="whitespace-nowrap px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="success"
              size="sm"
              disabled={schedule.tasks.length === 0 || busy}
              title={schedule.tasks.length === 0 ? 'Add a task first' : undefined}
              onClick={onRun}
            >
              {busy ? <LoaderCircle className="size-3 animate-spin" /> : <Play className="size-3" />}
              Run now
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={5} className="bg-muted/20 px-6 pb-5">
            <p className="mb-2 pt-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Tasks
            </p>
            {schedule.tasks.length > 0 ? (
              <div className="mb-3 space-y-1">
                {schedule.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="shrink-0 rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                        {task.action}
                      </span>
                      <span className="truncate font-mono text-xs">
                        {task.action === 'command'
                          ? String(task.payload.command ?? '')
                          : task.action === 'power'
                            ? String(task.payload.action ?? '')
                            : String(task.payload.name ?? '')}
                      </span>
                      {task.timeOffset > 0 ? (
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                          +{task.timeOffset}s
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeTask(task.id)}
                      className="shrink-0 p-2 text-destructive hover:opacity-80"
                      aria-label="Remove task"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm italic text-muted-foreground">No tasks yet. Add one below.</p>
            )}

            <div className="flex flex-wrap items-end gap-2.5">
              <div>
                <Label className="mb-1 block text-xs">Action</Label>
                <select
                  value={taskAction}
                  onChange={(e) => setTaskAction(e.target.value as 'command' | 'power' | 'backup')}
                  className="h-8 w-28 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="command">Command</option>
                  <option value="power">Power</option>
                  <option value="backup">Backup</option>
                </select>
              </div>
              {taskAction === 'command' ? (
                <div className="min-w-[200px] flex-1">
                  <Label className="mb-1 block text-xs">Command</Label>
                  <Input
                    value={taskCommand}
                    onChange={(e) => setTaskCommand(e.target.value)}
                    placeholder="say hello"
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
              ) : null}
              {taskAction === 'power' ? (
                <div>
                  <Label className="mb-1 block text-xs">Power action</Label>
                  <select
                    value={taskPower}
                    onChange={(e) => setTaskPower(e.target.value)}
                    className="h-8 w-32 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="start">Start</option>
                    <option value="stop">Stop</option>
                    <option value="restart">Restart</option>
                    <option value="kill">Kill</option>
                  </select>
                </div>
              ) : null}
              {taskAction === 'backup' ? (
                <div>
                  <Label className="mb-1 block text-xs">Backup name</Label>
                  <Input
                    value={taskBackupName}
                    onChange={(e) => setTaskBackupName(e.target.value)}
                    placeholder="daily"
                    className="w-48"
                    autoComplete="off"
                  />
                </div>
              ) : null}
              <div>
                <Label className="mb-1 block text-xs">Seconds before</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={taskOffset}
                  onChange={(e) => setTaskOffset(e.target.value)}
                  className="w-24"
                  autoComplete="off"
                />
              </div>
              <Button size="sm" disabled={adding} onClick={() => void addTask()}>
                {adding ? <LoaderCircle className="size-3 animate-spin" /> : <Plus className="size-3" />}
                Add task
              </Button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

/* ── Cron builder (cron + visual modes, mirrors the EJS) ────────────────── */

function CronBuilder({
  cron,
  onChange,
  error,
}: {
  cron: string
  onChange: (cron: string) => void
  error: boolean
}) {
  const [mode, setMode] = useState<'cron' | 'visual'>('cron')

  const [granular, setGranular] = useState<Record<string, { value: number; every: boolean; interval: number | null }>>({
    sec: { value: 0, every: true, interval: null },
    min: { value: 0, every: true, interval: null },
    hour: { value: 0, every: true, interval: null },
    dom: { value: 1, every: true, interval: null },
  })
  const [dowAll, setDowAll] = useState(true)
  const [dowDays, setDowDays] = useState<Set<number>>(new Set())
  const [visualWarn, setVisualWarn] = useState(false)

  const preview = useMemo(() => describeCron(cron), [cron])

  const applyGranular = (next: typeof granular, all = dowAll, days = dowDays) => {
    const built = buildGranularCron(next, all, days)
    onChange(built)
  }

  const setField = (key: string, patch: Partial<{ value: number; every: boolean; interval: number | null }>) => {
    const next = { ...granular, [key]: { ...granular[key], ...patch } }
    setGranular(next)
    applyGranular(next)
  }

  const stepField = (key: string, delta: number) => {
    const f = granular[key]
    const [min, max] = GRAN_LIMITS[key]
    if (f.every) {
      const n = Math.min(max, Math.max(2, (f.interval ?? 1) + delta))
      setField(key, { interval: n })
    } else {
      setField(key, { value: Math.min(max, Math.max(min, f.value + delta)) })
    }
  }

  const toggleDay = (day: number) => {
    const next = new Set(dowDays)
    if (next.has(day)) {
      next.delete(day)
    } else {
      next.add(day)
    }
    setDowDays(next)
    setDowAll(next.size === 0 || next.size === 7)
    applyGranular(granular, next.size === 0 || next.size === 7, next)
  }

  const switchToVisual = () => {
    // Parse the current cron into the visual fields; show a warning when
    // the expression can't be represented (mirrors syncVisualFromCron).
    const fields = cron.trim().split(/\s+/)
    const parts = fields.length === 6 ? fields : fields.length === 5 ? ['0', ...fields] : null
    const representable =
      parts &&
      parts.slice(0, 4).every((f) => /^(\*|\*\/\d+|\d+)$/.test(f)) &&
      /^(\*|[0-6](?:-[0-6])?)(,[0-6](?:-[0-6])?)*$/.test(parts[5])
    if (!representable) {
      setVisualWarn(true)
      setMode('visual')
      return
    }
    setVisualWarn(false)
    const next = { ...granular }
    GRAN_KEYS.forEach((key, i) => {
      const v = parts![i]
      const f = next[key]
      if (v === '*') {
        f.every = true
        f.interval = null
      } else if (/^\*\/\d+$/.test(v)) {
        f.every = true
        const n = parseInt(v.slice(2), 10)
        f.interval = n > 1 ? Math.min(GRAN_LIMITS[key][1], n) : null
      } else {
        f.every = false
        f.interval = null
        f.value = Math.min(GRAN_LIMITS[key][1], Math.max(GRAN_LIMITS[key][0], parseInt(v, 10) || (key === 'dom' ? 1 : 0)))
      }
    })
    const dowField = parts![5]
    if (dowField === '*') {
      setDowAll(true)
      setDowDays(new Set())
    } else {
      const days = new Set<number>()
      for (const part of dowField.split(',')) {
        const m = part.match(/^([0-6])(?:-([0-6]))?$/)
        if (!m) continue
        for (let i = +m[1]; i <= +(m[2] ?? m[1]); i++) days.add(i)
      }
      setDowDays(days)
      setDowAll(days.size === 7)
    }
    setGranular(next)
    setMode('visual')
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex rounded-lg bg-muted p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode('cron')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition ${
              mode === 'cron' ? 'bg-card shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Clock className="size-3" />
            Cron expression
          </button>
          <button
            type="button"
            onClick={switchToVisual}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition ${
              mode === 'visual' ? 'bg-card shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Calendar className="size-3" />
            Visual timing
          </button>
        </div>
      </div>

      {mode === 'cron' ? (
        <div className="space-y-1.5">
          <Label htmlFor="schedCron">Cron expression</Label>
          <Input
            id="schedCron"
            value={cron}
            onChange={(e) => {
              onChange(e.target.value)
              setVisualWarn(false)
            }}
            className="font-mono"
            placeholder="0 0 * * * *"
            autoComplete="off"
          />
          {error ? (
            <p className="flex items-center gap-1.5 text-[11px] text-destructive">
              <AlertTriangle className="size-3" />
              Cron must be 5 or 6 fields — second minute hour day month weekday — with values in
              range.
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Format: <span className="font-mono">second minute hour day month weekday</span> —{' '}
            <span className="font-medium text-accent">{preview}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GRAN_KEYS.map((key) => {
              const f = granular[key]
              return (
                <div key={key} className="rounded-xl border bg-muted/30 p-3">
                  <label className="mb-2 block text-[11px] font-medium text-muted-foreground">
                    {GRAN_LABELS[key]}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => stepField(key, -1)}
                      className="rounded-md p-1 hover:bg-muted"
                      aria-label={`Decrease ${GRAN_LABELS[key].toLowerCase()}`}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    {f.every ? (
                      <span className="flex w-full items-center justify-center gap-1 font-mono text-xs">
                        every{' '}
                        {f.interval !== null ? (
                          <b className="text-accent">{f.interval}</b>
                        ) : null}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={GRAN_LIMITS[key][0]}
                        max={GRAN_LIMITS[key][1]}
                        value={f.value}
                        onChange={(e) => setField(key, { value: Number(e.target.value) || 0 })}
                        className="w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-center font-mono text-sm outline-none focus-visible:border-ring"
                        aria-label={`${GRAN_LABELS[key]} value`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => stepField(key, 1)}
                      className="rounded-md p-1 hover:bg-muted"
                      aria-label={`Increase ${GRAN_LABELS[key].toLowerCase()}`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <label className="mt-2 inline-flex cursor-pointer items-center select-none">
                    <input
                      type="checkbox"
                      checked={f.every}
                      onChange={(e) => setField(key, { every: e.target.checked, interval: e.target.checked ? f.interval : null })}
                      className="peer sr-only"
                    />
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        f.every ? 'bg-accent/15 text-accent' : 'text-muted-foreground'
                      }`}
                    >
                      <Check className="size-3" />
                      every
                    </span>
                  </label>
                </div>
              )
            })}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
              Day of week
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDowAll(true)
                  setDowDays(new Set())
                  applyGranular(granular, true, new Set())
                }}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  dowAll ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                Every day
              </button>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                    !dowAll && dowDays.has(i)
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {visualWarn ? (
            <p className="flex items-center gap-2.5 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              This expression can't be shown visually — it uses ranges, lists, or values outside
              the visual editor. Edit it in Cron mode.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground" aria-live="polite">
              Runs <span className="font-medium text-accent">{preview}</span> — cron:{' '}
              <span className="font-mono font-medium text-accent">{cron}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
