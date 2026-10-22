import { CircleCheck, CircleX } from "lucide-react";

/** Where Stripe sends a customer back after paying for an order (or giving up). */
export default async function PaymentThanks({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const ref = typeof params.ref === "string" ? params.ref.replace(/[^A-Z0-9]/gi, "").slice(0, 12) : "";
  const cancelled = params.cancelled === "1";
  const Icon = cancelled ? CircleX : CircleCheck;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className={cancelled ? "text-muted" : "text-accent"} aria-hidden="true">
        <Icon className="size-10" strokeWidth={1.5} />
      </span>
      <h1 className="text-2xl font-medium tracking-tight">{cancelled ? "Payment not taken" : "Thank you — you’re paid"}</h1>
      <p className="max-w-md text-sm text-muted">
        {cancelled
          ? "Nothing was charged. You can use the same link again, or pay when you collect."
          : "Your order is in. Give your name at the counter when you collect."}
        {ref ? ` Order ${ref}.` : ""}
      </p>
    </main>
  );
}
