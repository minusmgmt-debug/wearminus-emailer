import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
  // ✅ Allow CORS (important so Shopify frontend can call this)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Handles preflight request
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, firstName, plan } = req.body || {};
    if (!email || !plan) {
      return res.status(400).json({ error: "Missing email or plan" });
    }

    // ✅ Create personalized PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 780;

    const draw = (text, size = 12) => {
      page.drawText(text, { x: 50, y, size, font, color: rgb(0, 0, 0) });
      y -= size + 8;
    };

    draw("Your 30-Day Fat Loss Plan", 20);
    draw(`Hi ${firstName || "there"}, here’s your personalized plan:`);

    if (plan.targets) {
      draw("Targets:");
      if (plan.targets.calories) draw(`• Calories/day: ${plan.targets.calories}`);
      if (plan.targets.protein) draw(`• Protein/day: ${plan.targets.protein} g`);
      if (plan.targets.steps) draw(`• Steps/day: ${plan.targets.steps}`);
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // ✅ Send email with PDF
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      // ⚠️ For now use Resend’s test domain
      from: "onboarding@resend.dev",
      to: email,
      subject: "Your Personalized Fat Loss Plan",
      html: `
        <p>Hi ${firstName || "there"},</p>
        <p>Attached is your 30-day fat loss plan (PDF), generated from your quiz results.</p>
        <p>You’ve got this! 💪<br/>— WearMinus Team</p>
      `,
      attachments: [
        { filename: "FatLossPlan.pdf", content: pdfBase64 }
      ]
    });

    return res.status(200).json({ ok: true, message: "Email sent with PDF" });
  } catch (err) {
    console.error("Error sending email:", err);
    return res.status(500).json({ error: "Failed to send PDF" });
  }
}
