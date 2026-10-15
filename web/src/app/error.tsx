'use client';

// App Router error boundary. Guarantees the UI never shows Next's raw error
// overlay / stack trace to a user in production — it renders this friendly card
// instead. The server-side error mapper (lib/http/errors.ts) does the same for
// the API; together they close the "leaked stack trace" gap the old Java app had.

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Logged for the developer (console / server logs); never surfaced to the user.
    console.error('Unhandled UI error:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="text-muted-foreground">
          We hit an unexpected problem while working out your trip. This is on us, not you. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <RotateCcw className="size-4" />
          Try again
        </button>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70 pt-2">Reference: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
