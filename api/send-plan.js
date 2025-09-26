import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
  // Allow CORS for Shopify
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, answers, plan } = req.body || {};
    if (!email || !plan) {
      return res.status(400).json({ error: "Missing email or plan" });
    }

    // ✅ Respond immediately so frontend always sees success
    res.status(200).json({ ok: true, message: "Plan queued for email delivery" });

    // 🔽 Continue work in background
    sendEmailWithPDF(email, answers, plan).catch((err) => {
      console.error("Background email failed:", err);
    });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// 🔽 Helper to build PDF and send email
async function sendEmailWithPDF(email, answers, plan) {
  // Create a PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = 800;

  const draw = (text, size = 12) => {
    page.drawText(text, { x: 40, y, size, font, color: rgb(0, 0, 0) });
    y -= size + 6;
  };

  draw("Your 30-Day Personalized Plan", 20);
  draw(`Hi ${answers?.name || "there"}, here is your full plan:`, 14);

  // Expand plan into PDF
  if (plan.summary) {
    draw("Summary:", 14);
    draw(plan.summary);
  }
  if (plan.warmup) {
    draw("Warm-up:", 14);
    draw(plan.warmup);
  }
  if (plan.schedule) {
    plan.schedule.forEach((day) => {
      draw(`${day.day} — ${day.label}`, 14);
      (day.blocks || []).forEach((b) => {
        draw(`• ${b.name} (${b.sets} x ${b.reps}, ${b.time || ""})`);
        if (b.howTo) {
          b.howTo.split("\n").forEach((line) => draw("   - " + line));
        }
      });
    });
  }
  if (plan.cardio) {
    draw("Cardio:", 14);
    draw(plan.cardio);
  }
  if (plan.cooldown) {
    draw("Cooldown:", 14);
    draw(plan.cooldown);
  }
  if (plan.notes) {
    draw("Notes:", 14);
    draw(plan.notes);
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  // Send via Resend
  const resend = new Resend(process.env.re_7ojhr7nU_Fuvy6xtMAqUanw6CtKA58wLP);
  await resend.emails.send({
    from: "no-reply@wearminus.com", // 👈 nobody can reply
    to: email,
    subject: "Your Personalized 30-Day Plan",
    html: `
      <p>Hi ${answers?.name || "there"},</p>
      <p>Your personalized 30-day fitness plan is attached as a PDF.</p>
      <p>💪 Stay consistent and repeat this week’s plan for the next 30 days.</p>
      <p>– Team WearMinus</p>
    `,
    attachments: [
      {
        filename: "YourPlan.pdf",
        content: pdfBase64,
      },
    ],
  });
}
