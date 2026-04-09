import { clsx } from "clsx";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx("h-10 w-10", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="jetforgeRing" x1="14" y1="84" x2="83" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#35ff86" />
          <stop offset="1" stopColor="#00e5ff" />
        </linearGradient>
        <linearGradient id="jetforgeLeaf" x1="24" y1="70" x2="69" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1dd7d0" />
          <stop offset="0.55" stopColor="#35ff86" />
          <stop offset="1" stopColor="#19ff43" />
        </linearGradient>
      </defs>

      <circle cx="48" cy="48" r="42" stroke="url(#jetforgeRing)" strokeWidth="2.4" />

      <path
        d="M28 57.5C28.8 40.5 40 30.3 55.1 24.8C64.3 21.4 70.1 17.8 74.1 12.8C73.7 26.4 71.2 35.4 63.7 41.8C57.9 46.8 50.6 48.7 43.7 51.8C36.3 55.1 31.2 59.4 28 67.6V57.5Z"
        fill="url(#jetforgeLeaf)"
      />
      <path
        d="M28 80.5C28.8 63.5 40 53.3 55.1 47.8C64.3 44.4 70.1 40.8 74.1 35.8C73.7 49.4 71.2 58.4 63.7 64.8C57.9 69.8 50.6 71.7 43.7 74.8C36.3 78.1 31.2 82.4 28 90.6V80.5Z"
        fill="url(#jetforgeLeaf)"
      />
    </svg>
  );
}
