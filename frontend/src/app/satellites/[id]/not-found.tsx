import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Not in the dataset</p>
        <h1>We have no record of that object.</h1>
        <p className="lede">
          Above Us holds a declared set of historic spacecraft, not the whole catalogue. Start from a{" "}
          <Link href="/discover">discovery</Link> or browse the <Link href="/graveyard">Space Graveyard</Link>.
        </p>
      </header>
    </div>
  );
}
