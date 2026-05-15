"use client";

import dynamic from "next/dynamic";

const HeaderDynamic = dynamic(
  () => import("@/components/Header").then((m) => m.Header),
  { ssr: false }
);

export function HeaderClient() {
  return <HeaderDynamic />;
}
