"use client";
export default function DocsKeyBoundary({
    bump,
    children,
}: {
    bump: string;
    children: React.ReactNode;
}) {
    return <div key={`docs-${bump}`}>{children}</div>;
}
