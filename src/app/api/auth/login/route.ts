import { NextResponse } from "next/server";
import { loginUser } from "@/lib/local/auth";
import { registerUser } from "@/lib/local/register";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
      githubHandle?: string;
      mode?: "signin" | "signup";
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const profile =
      body.mode === "signup"
        ? await registerUser({
            email: body.email,
            password: body.password,
            displayName: body.displayName,
            githubHandle: body.githubHandle,
          })
        : await loginUser(body.email, body.password);

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
