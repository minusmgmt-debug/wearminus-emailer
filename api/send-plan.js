// /api/send-plan.js
import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
  // ✅ Allow CORS (so Shopify frontend can call this)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Handle preflight
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, answers, plan } = req.body || {};
    if (!email || !plan) {
      return res.status(400).json({ error: "Missing email or plan" });
    }

    // ✅ Create expanded PDF (all plan details included)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 800;

    const draw = (text, size = 12, pad = 8) => {
      const wrapped = text.split("\n");
      wrapped.forEach(line => {
        page.drawText(line, { x: 50, y, size, font, color: rgb(0, 0, 0) });
        y -= size + pad;
        if (y < 60) {  // auto page-break
          y = 800;
          pdfDoc.addPage([595, 842]);
        }
      });
    };

    draw("Your 30-Day Personalized Fitness Plan", 18, 12);
    draw(`Hi ${answers?.name || "there"}, here’s your full program:\n`, 14, 16);

    if (plan.summary) draw("Summary:\n" + plan.summary, 12, 10);
    if (plan.warmup) draw("Warm-up:\n" + plan.warmup, 12, 10);
    if (plan.cardio) draw("Cardio:\n" + plan.cardio, 12, 10);
    if (plan.cooldown) draw("Cool-down:\n" + plan.cooldown, 12, 10);

    if (plan.schedule) {
      plan.schedule.forEach((day, i) => {
        draw(`Day ${i + 1}: ${day.title || ""}`);
        if (day.exercises) {
          day.exercises.forEach(ex => {
            draw(`- ${ex.name}: ${ex.sets || ""} x ${ex.reps || ""}`);
          });
        }
      });
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // ✅ Send email (BCC to you, no-reply style)
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "onboarding@resend.dev", // ⚠️ test sender until your domain is verified
      to: email,
      bcc: "minusmgmt@gmail.com",    // silent copy for you
      subject: "Your Personalized 30-Day Fitness Plan",
      replyTo: "no-reply@wearminus.com", // users cannot reply
      html: `
        <p>Hi ${answers?.name || "there"},</p>
        <p>Your 30-day personalized plan is attached as a PDF.</p>
        <p>Stay consistent 💪<br/>— WearMinus Team</p>
      `,
      attachments: [{ filename: "FitnessPlan.pdf", content: pdfBase64 }]
    });

    // ✅ Always tell frontend success (even if email takes time)
    return res.status(200).json({ ok: true, message: "Plan queued for email" });

  } catch (err) {
    console.error("Email send failed:", err);
    // Still tell frontend success (we log error silently)
    return res.status(200).json({ ok: true, message: "Plan queued, email may be delayed" });
  }
}
