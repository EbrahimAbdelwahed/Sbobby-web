import Link from "next/link";

export function SiteNav() {
  return (
    <nav className="sb-topnav" aria-label="Navigazione principale">
      <Link className="sb-topnav-brand" href="/studio">
        Sbobby
      </Link>
      <div className="sb-topnav-links">
        <Link href="/studio">Studio</Link>
        <Link href="/admin/review">Review admin</Link>
      </div>
    </nav>
  );
}
