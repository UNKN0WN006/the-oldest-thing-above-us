import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">404</p>
        <h1>Nothing in this part of the sky.</h1>
        <p className="lede">
          <Link href="/">Return to the globe</Link> or <Link href="/discover">start a discovery</Link>.
        </p>
      </header>
    </div>
  );
}
