import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PrivyProvider } from "@/components/PrivyProvider";
import { NearProvider } from "@/context/NearContext";
import { routing } from "@/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PrivyProvider>
        <NearProvider>{children}</NearProvider>
      </PrivyProvider>
    </NextIntlClientProvider>
  );
}
