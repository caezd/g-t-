import { NextResponse } from "next/server";

export async function POST() {
    const res = new NextResponse(null, { status: 204 });
    // change la valeur à chaque appel -> re-mount garanti
    res.cookies.set("docs_bump", Date.now().toString(), {
        httpOnly: false, // lisible côté server RSC et côté client
        path: "/",
        sameSite: "lax",
    });
    return res;
}
