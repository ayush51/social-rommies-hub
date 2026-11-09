import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Nothing here</h1>
      <p className="text-neutral-500">That page doesn&apos;t exist, or it isn&apos;t yours to see.</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white">Back to Home</Link>
    </main>
  );
}
