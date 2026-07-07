import { Baloo_2 } from "next/font/google";

const baloo = Baloo_2({ subsets: ["latin"], weight: ["700", "800"] });

// PRIEDS wordmark: rounded lowercase type in brand cyan with the darker blue
// accent, plus the "Your Primary Needs" tagline.
export default function PriedsLogo({ size = "md", tagline = false }: { size?: "sm" | "md" | "lg"; tagline?: boolean }) {
  const px = size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-xl";
  const tag = size === "lg" ? "text-sm tracking-[0.35em]" : "text-[10px] tracking-[0.3em]";
  return (
    <div className="inline-flex flex-col items-center leading-none select-none">
      <span className={`${baloo.className} ${px} font-extrabold lowercase`} style={{ color: "#49C5E9", letterSpacing: "-0.02em" }}>
        prie<span style={{ color: "#097EB9" }}>d</span>s
      </span>
      {tagline && (
        <span className={`${tag} uppercase text-slate-500 font-medium mt-1`}>Your Primary Needs</span>
      )}
    </div>
  );
}
