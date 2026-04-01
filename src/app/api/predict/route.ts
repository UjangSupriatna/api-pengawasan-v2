import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    // Validation
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
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");

    // Check if z-ai-web-dev-sdk is available (only in Z.ai environment)
    // On Vercel, we use a remote inference server or fallback
    let prediction = "Normal";
    let reason = "Analisis berhasil";
    let usedVLM = false;

    try {
      // Dynamic import so it doesn't crash on Vercel
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      const imageUrl = `data:${file.type};base64,${base64Image}`;
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

      if (content) {
        usedVLM = true;
        try {
          const cleaned = content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          const parsed = JSON.parse(cleaned);
          prediction =
            parsed.prediction === "Mencurigakan" ? "Mencurigakan" : "Normal";
          reason = parsed.reason || "Analisis berhasil";
        } catch {
          if (content.toLowerCase().includes("mencurigakan")) {
            prediction = "Mencurigakan";
          }
          reason = content.substring(0, 200);
        }
      }
    } catch {
      // z-ai-web-dev-sdk not available (e.g., on Vercel)
      // Use remote inference server or basic fallback
      const inferenceUrl = process.env.INFERENCE_SERVER_URL;

      if (inferenceUrl) {
        // Proxy mode: forward to a running inference server
        try {
          const proxyFormData = new FormData();
          proxyFormData.append("file", file);
          proxyFormData.append("user_id", userId);

          const proxyRes = await fetch(inferenceUrl, {
            method: "POST",
            body: proxyFormData,
          });
          const proxyData = await proxyRes.json();

          if (proxyRes.ok && proxyData.prediction) {
            prediction =
              proxyData.prediction === "Mencurigakan"
                ? "Mencurigakan"
                : "Normal";
            reason = proxyData.reason || "Analisis via remote server";
            usedVLM = true;
          }
        } catch {
          // Remote server also failed, use fallback
        }
      }

      // Fallback: basic heuristic based on image metadata
      if (!usedVLM) {
        // If image is very small or very large, might indicate issue
        if (file.size < 5000) {
          prediction = "Mencurigakan";
          reason = "Gambar terlalu kecil, kemungkinan kamera tidak aktif";
        } else if (file.size > 5 * 1024 * 1024) {
          prediction = "Mencurigakan";
          reason = "File terlalu besar untuk analisis cepat";
        } else {
          prediction = "Normal";
          reason = "Analisis dasar: gambar diterima, kamera aktif";
        }
      }
    }

    // Save to database (non-blocking: don't fail the request if DB fails)
    try {
      await db.pengawasan.create({
        data: { userId, userName: "Unknown", prediction, reason },
      });
    } catch {
      // DB save failed (e.g., on Vercel without database) — that's OK
      console.error("DB save skipped (no database available)");
    }

    return NextResponse.json({
      prediction,
      reason,
      engine: usedVLM ? "vlm" : "fallback",
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
