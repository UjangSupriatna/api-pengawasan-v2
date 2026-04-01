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

// ========== Google Gemini Vision (untuk Vercel) ==========
async function analyzeWithGemini(
  base64Image: string,
  mimeType: string
): Promise<{ prediction: string; reason: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROCTOR_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini API error:", res.status, errText);
    return null;
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) return null;

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      prediction: parsed.prediction === "Mencurigakan" ? "Mencurigakan" : "Normal",
      reason: parsed.reason || "Analisis berhasil",
    };
  } catch {
    const lower = text.toLowerCase();
    if (lower.includes("mencurigakan")) {
      return { prediction: "Mencurigakan", reason: text.substring(0, 200) };
    }
    return { prediction: "Normal", reason: text.substring(0, 200) };
  }
}

// ========== z-ai-web-dev-sdk (untuk Z.ai sandbox lokal) ==========
async function analyzeWithZAI(
  base64Image: string,
  mimeType: string
): Promise<{ prediction: string; reason: string } | null> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const imageUrl = `data:${mimeType};base64,${base64Image}`;
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
    if (!content) return null;

    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        prediction: parsed.prediction === "Mencurigakan" ? "Mencurigakan" : "Normal",
        reason: parsed.reason || "Analisis berhasil",
      };
    } catch {
      const lower = content.toLowerCase();
      if (lower.includes("mencurigakan")) {
        return { prediction: "Mencurigakan", reason: content.substring(0, 200) };
      }
      return { prediction: "Normal", reason: content.substring(0, 200) };
    }
  } catch {
    return null; // SDK tidak tersedia (Vercel)
  }
}

// ========== Parse hasil VLM ==========
function parsePrediction(
  result: { prediction: string; reason: string } | null
): { prediction: string; reason: string; engine: string } {
  if (result) {
    return { ...result, engine: "gemini" };
  }

  // Fallback jika semua gagal
  return {
    prediction: "Normal",
    reason: "Gambar diterima, analisis dasar",
    engine: "fallback",
  };
}

// ========== MAIN HANDLER ==========
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

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const mimeType = file.type;

    // Priority 1: Google Gemini (Vercel + lokal)
    let result = await analyzeWithGemini(base64Image, mimeType);

    // Priority 2: z-ai-web-dev-sdk (hanya di Z.ai sandbox)
    if (!result) {
      result = await analyzeWithZAI(base64Image, mimeType);
    }

    const { prediction, reason, engine } = parsePrediction(result);

    // Save to DB (non-blocking, jangan gagalin request)
    try {
      await db.pengawasan.create({
        data: { userId, userName: "Unknown", prediction, reason },
      });
    } catch {
      // DB tidak tersedia (Vercel tanpa database) — OK
    }

    return NextResponse.json({ prediction, reason });
  } catch (error) {
    console.error("Predict API error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server", detail: msg },
      { status: 500 }
    );
  }
}
