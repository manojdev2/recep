import { toast } from "sonner";

const PREFIX = "Plan limit: ";

export function isPlanLimit(message: string) {
  return message.startsWith(PREFIX);
}

/** Show an error toast; plan-limit errors get a "See plans" action. */
export function toastError(err: Error, seePlans: () => void) {
  if (isPlanLimit(err.message)) {
    toast.error(err.message.slice(PREFIX.length), { duration: 8000, action: { label: "See plans", onClick: seePlans } });
    return;
  }
  toast.error(err.message);
}
