import { createFileRoute } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/_app/credits')({
  component: CreditsPage,
})

const THANKS = [
  'Pterodactyl — the panel this project was born from',
  'The Jexactyl community for early inspiration',
  'Every contributor who filed issues, wrote docs, or fixed a bug',
  'The Minecraft hosting community for pushing panels forward',
]

function CreditsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl border bg-muted">
          <Sparkles className="size-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arclight Panel — free, open-source game server management.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thanks</CardTitle>
          <CardDescription>This project stands on the shoulders of others.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {THANKS.map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Arclight Panel is licensed under the MIT License. Not affiliated with Mojang or
        Microsoft.
      </p>
    </div>
  )
}
