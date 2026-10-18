import ResultView from "@/components/ResultView";

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; lat?: string; lon?: string }>;
}) {
  const { city } = await searchParams;
  return <ResultView city={city?.trim() || "your location"} />;
}
