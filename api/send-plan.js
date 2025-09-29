// api/send-plan.js
import fetch from "node-fetch";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
  // Allow CORS
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

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Generate PDF from plan data
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("Your Personalized Fitness Plan", {
      x: 50,
      y: 750,
      size: 20,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    let y = 700;
    plan.forEach((item, idx) => {
      page.drawText(`${idx + 1}. ${item}`, { x: 50, y, size: 12, font });
      y -= 20;
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // Send email using Klaviyo API
    const response = await fetch("https://a.klaviyo.com/api/v1/email-template/send", {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${process.env.pk_4034baf5c00c8d51c10b3cbc3cab14ca4c}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: email,
        from_email: "rayan@wearminus.com",
        from_name: "Wearminus Team",
        subject: "Your Personalized Fitness Plan",
        body: "<p>Hi,</p><p>Your 30-day personalized plan is attached as a PDF.</p>",
        attachments: [
          {
            name: "fitness-plan.pdf",
            content: pdfBase64,
            type: "application/pdf",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Klaviyo error:", errorText);
      return res.status(500).json({ error: "Failed to send email", details: errorText });
    }

    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
}
