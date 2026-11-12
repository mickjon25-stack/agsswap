import { initialsFor } from "@/lib/avatar";

/** Round profile picture with an initials fallback. Works in server and client components. */
export function Avatar({
  url,
  name,
  size = "md",
  className,
}: {
  url?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const cls = ["avatar", size === "md" ? "" : size, className || ""].filter(Boolean).join(" ");
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={url} alt={name ? `${name}'s profile photo` : "Profile photo"} />;
  }
  return (
    <span className={`${cls} avatar-initials`} role="img" aria-label={name ? `${name} (no photo)` : "No photo"}>
      {initialsFor(name)}
    </span>
  );
}
