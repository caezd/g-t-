// app/auth/confirm/page.tsx
import ConfirmPageClient from "./ConfirmPageClient";

type PageProps = {
    searchParams: { [key: string]: string | string[] | undefined };
};

export default function AuthConfirmPage({ searchParams }: PageProps) {
    const raw = searchParams.confirmation_url;

    // On normalise: string | null
    const confirmationUrl =
        typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

    // On délègue toute la logique à un composant client
    return <ConfirmPageClient confirmationUrl={confirmationUrl} />;
}
