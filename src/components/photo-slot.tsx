"use client";

import { useRef } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";

type Props = {
  label: string;
  facing: "environment" | "user";
  preview?: string;
  onPick: (file: File) => void;
};

export function PhotoSlot({ label, facing, preview, onPick }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="aspect-[3/4] overflow-hidden rounded-3xl bg-neutral-200 dark:bg-neutral-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => camera.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-white py-2 text-sm dark:bg-neutral-800">
          <Camera size={16} /> Camera
        </button>
        <button type="button" onClick={() => library.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-white py-2 text-sm dark:bg-neutral-800">
          <ImageIcon size={16} /> Library
        </button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture={facing} onChange={handle} hidden />
      <input ref={library} type="file" accept="image/*" onChange={handle} hidden />
    </div>
  );
}
