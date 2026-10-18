export default function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-serif text-xl">{value}</dd>
    </div>
  );
}
