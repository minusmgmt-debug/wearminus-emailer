import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
  // ✅ Allow CORS so Shopify frontend can call this API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Preflight response
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, answers, plan } = req.body || {};
    if (!email || !plan) {
      return res.status(400).json({ error: "Missing email or plan" });
    }

    // ✅ Use quiz answers for name if available
    const firstName = answers?.name || "there";

    // --- Build PDF ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 780;

    const draw = (text, size = 12) => {
      page.drawText(text, { x: 50, y, size, font, color: rgb(0, 0, 0) });
      y -= size + 8;
    };

    draw("Your 30-Day Fitness Plan", 20);
    draw(`Hi ${firstName}, here’s your personalized plan:`);

    if (plan.summary) draw(`Summary: ${plan.summary}`);
    if (plan.splitUsed) draw(`Split: ${plan.splitUsed}`);
    if (plan.notes) draw(`Notes: ${plan.notes}`);

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // --- Send email via Resend ---
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "onboarding@resend.dev", // or use a verified domain if you set one up
      to: email,
      subject: "Your Personalized Fitness Plan",
      html: `
        <p>Hi ${firstName},</p>
        <p>Attached is your 30-day fitness plan (PDF), generated from your quiz results.</p>
        <p>You’ve got this! 💪<br/>— WearMinus Team</p>
      `,
      attachments: [
        { filename: "FitnessPlan.pdf", content: pdfBase64 }
      ]
    });

    return res.status(200).json({ ok: true, message: "Email sent with PDF" });
  } catch (err) {
    console.error("Error sending email:", err);
    return res.status(500).json({ error: "Failed to send PDF" });
  }
}
