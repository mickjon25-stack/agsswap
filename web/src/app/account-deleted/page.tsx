import Link from "next/link";

export const metadata = { title: "Account deleted · AgsSwap" };

export default function AccountDeletedPage() {
  return (
    <div className="wrap">
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Your account was deleted</h2>
        <p className="help">
          Your listings, photos, alerts and settings have been removed and you&apos;ve been signed out.
          Thanks for being part of AgsSwap.
        </p>
        <Link href="/" className="ghost">Back to home</Link>
      </div>
    </div>
  );
}
