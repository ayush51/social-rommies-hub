import { PawPrint } from "lucide-react";

export function PetAvatar({ url, name, className = "" }: { url?: string | null; name: string; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={`object-cover ${className}`} />
  ) : (
    <div role="img" aria-label={name} className={`flex items-center justify-center bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-300 ${className}`}>
      <PawPrint size={36} aria-hidden />
    </div>
  );
}
