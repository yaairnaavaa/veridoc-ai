import { MarketplaceProvider } from "@/context/MarketplaceContext";

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
