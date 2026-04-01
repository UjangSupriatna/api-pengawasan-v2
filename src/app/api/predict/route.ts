import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

const PROCTOR_PROMPT = `Kamu adalah sistem pengawasan ujian (proctoring). Analisis gambar webcam ini dan tentukan apakah perilaku yang terlihat "Normal" atau "Mencurigakan".

Kriteria NORMAL:
- Tepat 1 wajah terlihat jelas di frame
- Mata peserta terlihat dan terbuka
- Peserta menatap ke arah layar/depan
- Tidak ada orang lain di belakang atau di sekitar
- Tidak ada perangkat elektronik tambahan (handphone, tablet, dll)

Kriteria MENCURIGAKAN:
- Tidak ada wajah terdeteksi di frame
- Lebih dari 1 wajah terdeteksi
- Mata tertutup atau tidak terlihat
- Peserta tidak menatap ke arah layar
- Ada orang lain di dalam frame
- Ada perangkat elektronik tambahan yang terlihat
- Peserta terlihat sedang berkomunikasi dengan orang lain
- Kepala menoleh jauh dari layar secara konsisten

Jawablah HANYA dengan format JSON berikut (tanpa markdown, tanpa backtick):
{"prediction": "Normal" atau "Mencurigakan", "reason": "Penjelasan singkat dalam Bahasa Indonesia"}`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("user_id") as string | null;

    // Validation — sama persis dengan Flask asli
    if (!file) {
      return NextResponse.json({ error: "No file part" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "No selected file" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid image format" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Convert file to base64 for VLM
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const imageUrl = `data:${file.type};base64,${base64Image}`;

    // Analisis dengan VLM (gantian OpenCV + model .h5)
    const zai = await ZAI.create();
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROCTOR_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      thinking: { type: "disabled" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "Gagal menganalisis gambar" },
        { status: 500 }
      );
    }

    // Parse VLM response
    let prediction = "Normal";
    let reason = "Analisis berhasil";

    try {
      const cleanedContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(cleanedContent);
      prediction =
        parsed.prediction === "Mencurigakan" ? "Mencurigakan" : "Normal";
      reason = parsed.reason || "Analisis berhasil";
    } catch {
      const lowerContent = content.toLowerCase();
      if (lowerContent.includes("mencurigakan")) {
        prediction = "Mencurigakan";
      }
      reason = content.substring(0, 200);
    }

    // Simpan ke database (gantian CSV asli)
    await db.pengawasan.create({
      data: {
        userId,
        userName: "Unknown",
        prediction,
        reason,
      },
    });

    // Response format sama persis dengan Flask asli: { "prediction": "Normal" | "Mencurigakan" }
    // field tambahan (reason) tidak mengganggu code lama
    return NextResponse.json({
      prediction,
      reason,
    });
  } catch (error) {
    console.error("Predict API error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server", detail: msg },
      { status: 500 }
    );
  }
}
