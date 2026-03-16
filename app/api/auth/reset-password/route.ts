import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (!token || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!record || record.expiresAt < new Date() || !record.user) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    await prisma.user.update({
      where: { id: record.user.id },
      data: { passwordHash },
    });
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return NextResponse.json({ message: "Password updated" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
