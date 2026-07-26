// A join code entered before onboarding — the name screen consumes it.
let code: string | null = null;

export function setPendingJoin(c: string | null) {
  code = c;
}

export function takePendingJoin(): string | null {
  const c = code;
  code = null;
  return c;
}
