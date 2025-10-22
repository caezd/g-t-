"use client";
export default function DocsKeyBoundary({
    bump,
    children,
    ...props
}: {
    bump: string;
    children: React.ReactNode;
}) {
    return (
        <div key={`docs-${bump}`} {...props}>
            {children}
        </div>
    );
}
