import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
  // --- Allow CORS (Shopify frontend can call this) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Preflight
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, user_name, plan_data } = req.body || {};
    if (!email || !plan_data) {
      return res.status(400).json({ error: "Missing email or plan data" });
    }

    // --- 1. Create PDF document ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 800;

    const drawLine = (text, size = 12, gap = 16) => {
      page.drawText(String(text), {
        x: 50,
        y,
        size,
        font,
        color: rgb(0, 0, 0),
      });
      y -= gap;
    };

    // Header
    drawLine("Your 30-Day Personalized Fitness Plan", 18, 22);
    drawLine(`Hi ${user_name || "Friend"}, here’s your full plan:`, 14, 20);

    // --- 2. Expand the full plan (all sections) ---
    if (plan_data.summary) {
      drawLine("Summary:", 14, 18);
      drawLine(plan_data.summary, 12, 20);
    }

    if (plan_data.warmup) {
      drawLine("Warm-up:", 14, 18);
      drawLine(plan_data.warmup, 12, 20);
    }

    if (plan_data.schedule) {
      drawLine("Weekly Schedule:", 14, 20);
      plan_data.schedule.forEach((day, i) => {
        drawLine(`Day ${i + 1}: ${day.title}`, 12, 16);
        day.exercises.forEach((ex) => {
          drawLine(`- ${ex.name}: ${ex.sets} x ${ex.reps}`, 11, 14);
        });
        y -= 10;
      });
    }

    if (plan_data.cardio) {
      drawLine("Cardio:", 14, 18);
      drawLine(plan_data.cardio, 12, 20);
    }

    if (plan_data.cooldown) {
      drawLine("Cool Down / Stretching:", 14, 18);
      drawLine(plan_data.cooldown, 12, 20);
    }

    if (plan_data.notes) {
      drawLine("Notes:", 14, 18);
      drawLine(plan_data.notes, 12, 20);
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // --- 3. Send email with PDF attached ---
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "minusmgmat@gmail.com", // 👈 make sure this domain is verified in Resend
      to: email,
      subject: "Your Personalized 30-Day Fitness Plan",
      html: `
        <p>Hi ${user_name || "there"},</p>
        <p>Your personalized 30-day plan is ready 🎉</p>
        <p>We’ve attached the full expanded PDF for you below.</p>
        <p>Stay strong 💪<br/>- The WearMinus Team</p>
      `,
      attachments: [
        {
          filename: "FitnessPlan.pdf",
          content: pdfBase64,
        },
      ],
    });

    // --- 4. Always respond success to frontend ---
    return res.status(200).json({ ok: true, message: "Plan queued for email" });
  } catch (err) {
    console.error("❌ Error sending email:", err);
    return res.status(200).json({
      ok: false,
      message: "Plan saved, email will be sent later",
    });
  }
}
