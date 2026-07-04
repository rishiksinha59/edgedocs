import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validations/auth";
import { formatErrorResponse, ValidationError, AppError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      const error = new ValidationError("Validation failed", fieldErrors);
      return NextResponse.json(formatErrorResponse(error), { status: 400 });
    }

    const { name, email, password } = parsed.data;

    // Check if user already exists
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

    if (existing) {
      const error = new ValidationError("An account with this email already exists", {
        email: ["An account with this email already exists"],
      });
      return NextResponse.json(formatErrorResponse(error), { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    return NextResponse.json({ user: { id: newUser.id, email: newUser.email, name: newUser.name } }, { status: 201 });
  } catch (err) {
    console.error("Registration error:", err);
    if (err instanceof AppError) {
      return NextResponse.json(formatErrorResponse(err), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 });
  }
}
