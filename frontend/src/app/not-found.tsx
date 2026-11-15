import { BackLink } from "@/components/ui/PageHeader";

export default function NotFound() {
  return (
    <div className="page flex max-w-md flex-col items-center gap-4 pt-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-2xl font-semibold">This page does not exist</h1>
      <BackLink />
    </div>
  );
}
