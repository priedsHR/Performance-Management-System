/* eslint-disable @next/next/no-img-element */

// Official PRIEDS logo (image asset in /public). The logo already contains the
// "Your Primary Needs" tagline, so `tagline` simply controls how much vertical
// room to give it (larger heights show the tagline legibly).
export default function PriedsLogo({ size = "md", tagline = false }: { size?: "sm" | "md" | "lg"; tagline?: boolean }) {
  const height = size === "lg" ? (tagline ? 88 : 64) : size === "md" ? (tagline ? 60 : 44) : 30;
  return (
    <img
      src="/prieds-logo.png"
      alt="PRIEDS — Your Primary Needs"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
