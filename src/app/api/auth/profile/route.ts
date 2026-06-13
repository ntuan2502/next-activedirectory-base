import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { type, displayName, email, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    const isLocal = user.dn === "" || !user.dn;

    if (type === "profile") {
      if (!isLocal) {
        return NextResponse.json(
          { error: "Profile is synchronized from Active Directory and cannot be modified here." },
          { status: 400 },
        );
      }

      if (!displayName || !email) {
        return NextResponse.json(
          { error: "Display name and email are required." },
          { status: 400 },
        );
      }

      // Check if email format is valid
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Invalid email format." },
          { status: 400 },
        );
      }

      const before = {
        displayName: user.displayName,
        email: user.email,
      };

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName,
          email: email.toLowerCase(),
        },
      });

      await logAction("user:update_profile", user.username, {
        before,
        after: {
          displayName: updatedUser.displayName,
          email: updatedUser.email,
        },
      });

      return NextResponse.json({
        success: true,
        user: {
          displayName: updatedUser.displayName,
          email: updatedUser.email,
        },
      });
    }

    if (type === "password") {
      if (!isLocal) {
        await logAction("user:change_password", "failed", "Attempted to modify AD password.");
        return NextResponse.json(
          { error: "Password is authenticated by Active Directory and cannot be modified here." },
          { status: 400 },
        );
      }

      if (!currentPassword || !newPassword) {
        await logAction("user:change_password", "failed", "Current password and new password are required.");
        return NextResponse.json(
          { error: "Current password and new password are required." },
          { status: 400 },
        );
      }

      if (newPassword.length < 8) {
        await logAction("user:change_password", "failed", "New password must be at least 8 characters long.");
        return NextResponse.json(
          { error: "New password must be at least 8 characters long." },
          { status: 400 },
        );
      }

      // If user has a passwordHash, verify it
      if (user.passwordHash) {
        const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!passwordMatch) {
          await logAction("user:change_password", "failed", "Incorrect current password.");
          return NextResponse.json(
            { error: "Incorrect current password." },
            { status: 400 },
          );
        }
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
        },
      });

      await logAction("user:change_password", "success", "Password updated successfully.");

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid update type." },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
