import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (!user) {
      return NextResponse.json({ message: "If an account exists, a reset link was sent." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    await prisma.passwordResetToken.create({
      data: {
        email: user.email,
        token,
        expiresAt,
        userId: user.id,
      },
    });
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    return NextResponse.json({
      message: "If an account exists, a reset link was sent.",
      resetUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
