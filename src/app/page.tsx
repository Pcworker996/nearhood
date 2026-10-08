import NearhoodBrowser from "@/components/nearhood-browser";

export default function Page() {
  return (
    <NearhoodBrowser mapTilerKey={process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ""} />
  );
}
