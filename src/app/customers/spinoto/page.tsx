import type { Metadata } from "next";
import { SpinotoLanding } from "@/components/landing/customers/spinoto";

export const metadata: Metadata = {
  title: "Spinoto · Mechanic in Minutes",
  description: "Verified doorstep mechanics for bikes, scooters, cars and SUVs in Ahmedabad. Book 24/7 by phone or WhatsApp.",
};

export default function SpinotoPage() {
  return <SpinotoLanding />;
}
