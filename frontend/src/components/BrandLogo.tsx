"use client";

import { clsx } from "clsx";
import { BrandMark } from "@/components/BrandMark";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function BrandLogo({
  className,
  markClassName,
  titleClassName,
  subtitleClassName,
}: BrandLogoProps) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <BrandMark className={clsx("h-10 w-10 shrink-0 drop-shadow-[0_0_18px_rgba(0,255,136,0.16)]", markClassName)} />

      <div className="leading-tight">
        <div
          className={clsx(
            "bg-[linear-gradient(90deg,#ffffff_0%,#f3fff9_24%,#45ff90_65%,#00d9ff_100%)] bg-clip-text text-[17px] font-black tracking-tight text-transparent sm:text-[19px]",
            titleClassName
          )}
        >
          JetForge
        </div>
        <div
          className={clsx(
            "mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/35",
            subtitleClassName
          )}
        >
          Solana Launchpad
        </div>
      </div>
    </div>
  );
}
