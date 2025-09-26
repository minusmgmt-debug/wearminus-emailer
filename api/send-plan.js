import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { email, firstName, plan } = req.body || {};
    if (!email || !plan) return res.status(400).json({ error: "Missing email or plan" });

    // 1. Create PDF dynamically
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
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

    // 2. Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "WearMinus <plan@wearminus.com>", // later replace with your verified domain
      to: email,
      subject: "Your Personalized Fat Loss Plan",
      html: `
        <p>Hi ${firstName || "there"},</p>
        <p>Attached is your 30-day fat loss plan (PDF).</p>
        <p>You’ve got this! 💪<br/>— WearMinus</p>
      `,
      attachments: [
        { filename: "FatLossPlan.pdf", content: pdfBase64 }
      ]
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send PDF" });
  }
}
