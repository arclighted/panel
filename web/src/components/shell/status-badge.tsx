import type { ServerStatus } from '@/lib/dashboard'
import { cn } from '@/lib/utils'

const CONFIGS: Record<
  ServerStatus,
  { label: string; cls: string; dot: string }
> = {
  online: {
    label: 'Online',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  offline: {
    label: 'Offline',
    cls: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/70',
  },
  starting: {
    label: 'Starting',
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  stopping: {
    label: 'Stopping',
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  installing: {
    label: 'Installing',
    cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    dot: 'bg-sky-500',
  },
  suspended: {
    label: 'Suspended',
    cls: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/70',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: ServerStatus
  className?: string
}) {
  const cfg = CONFIGS[status] ?? CONFIGS.offline
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        cfg.cls,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
