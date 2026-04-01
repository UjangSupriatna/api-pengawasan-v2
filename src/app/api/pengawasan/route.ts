import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Retrieve pengawasan records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const prediction = searchParams.get("prediction");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build where clause
    const where: Record<string, unknown> = {};
    if (userId) {
      where.userId = userId;
    }
    if (prediction) {
      where.prediction = prediction;
    }

    // Get records with pagination
    const [records, total] = await Promise.all([
      db.pengawasan.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.pengawasan.count({ where }),
    ]);

    // Get statistics
    const stats = await db.pengawasan.groupBy({
      by: ["prediction"],
      _count: { prediction: true },
    });

    const normalCount =
      stats.find((s) => s.prediction === "Normal")?._count.prediction || 0;
    const suspiciousCount =
      stats.find((s) => s.prediction === "Mencurigakan")?._count
        .prediction || 0;

    return NextResponse.json({
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        normal: normalCount,
        mencurigakan: suspiciousCount,
        total: normalCount + suspiciousCount,
      },
    });
  } catch (error) {
    console.error("Pengawasan API error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
