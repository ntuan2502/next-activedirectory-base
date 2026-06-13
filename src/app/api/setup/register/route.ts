import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    // 1. Guard check: Ensure no users exist yet
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { error: "Initial setup has already been completed. Registration blocked." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { username, displayName, email, password } = body;

    // Validation
    if (!username || !displayName || !email || !password) {
      return NextResponse.json({ error: "Missing required admin registration fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // 2. Ensure Super Admin role exists in DB
    let superAdminRole = await prisma.role.findFirst({
      where: { isSystem: true, name: "Super Admin" },
    });

    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          name: "Super Admin",
          description: "Built-in system administrator with full access",
          permissions: '["*"]',
          isSystem: true,
        },
      });
    }

    // 3. Hash password and save local user
    const passwordHash = await bcrypt.hash(password, 12);
    const lowercaseUsername = username.toLowerCase();

    const createdUser = await prisma.user.create({
      data: {
        username: lowercaseUsername,
        displayName,
        email,
        passwordHash,
        dn: "", // Local user identifier
        disabled: false,
        lastLoginAt: new Date(),
        roles: {
          connect: { id: superAdminRole.id },
        },
      },
    });

    // 4. Log the action
    await logAction(
      "auth:initial_setup",
      "success",
      {
        message: "First system administrator registered successfully",
        adminUsername: lowercaseUsername,
        adminEmail: email,
      },
      {
        userId: createdUser.id,
        username: lowercaseUsername,
      }
    );

    return NextResponse.json({
      success: true,
      message: "System administrator created successfully",
      data: {
        userId: createdUser.id,
        username: lowercaseUsername,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register system administrator";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
