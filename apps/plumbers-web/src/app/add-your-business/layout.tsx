import type { Metadata } from "next";

// page.tsx is a client component and can't export metadata, so this
// passthrough layout supplies the route's title/description + canonical.
export const metadata: Metadata = {
  title: "Add Your Business",
  description:
    "List your plumbing business on Fast Plumber Near Me. Reach homeowners searching for emergency plumbers in your city — free basic listing.",
  alternates: { canonical: "/add-your-business" },
};

export default function AddYourBusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
