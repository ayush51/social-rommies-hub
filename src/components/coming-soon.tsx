export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-neutral-500">Coming soon.</p>
    </>
  );
}
