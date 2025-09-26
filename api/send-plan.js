import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
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
    const { email, user_name, plan_data } = req.body || {};
    if (!email || !plan_data) {
      return res.status(400).json({ error: "Missing email or plan data" });
    }

    // ✅ Respond immediately so frontend shows "will be sent soon"
    res.status(200).json({ ok: true, message: "Plan will be sent soon" });

    // ---- Generate Expanded PDF ----
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 780;

    const draw = (text, size = 12, gap = 6) => {
      const lines = text.split("\n");
      for (let line of lines) {
        page.drawText(line, { x: 50, y, size, font, color: rgb(0, 0, 0) });
        y -= size + gap;
        if (y < 50) {
          y = 780;
          pdfDoc.addPage([595, 842]);
        }
      }
    };

    draw("Your Personalized 30-Day Plan", 20, 12);
    draw(`Hi ${user_name || "there"}, here’s your complete expanded plan:\n`);

    const sections = [
      ["Summary", plan_data.summary],
      ["Warm-up", plan_data.warmup],
      ["Weekly Schedule", plan_data.schedule],
      ["Cardio", plan_data.cardio],
      ["Cool Down", plan_data.cooldown],
      ["Notes", plan_data.notes],
    ];

    for (const [title, content] of sections) {
      draw(`\n${title}:`, 16, 10);
      if (content) draw(content.toString(), 12, 6);
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // ---- Send Email ----
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "minusmgmt@gmail.com", // ✅ your email
      to: email,
      subject: "Your Personalized 30-Day Plan",
      html: `
        <p>Hi ${user_name || "there"},</p>
        <p>Your complete 30-day fitness plan is attached as a PDF.</p>
        <p>You’ve got this 💪 — WearMinus Team</p>
        <p style="color:#888;font-size:0.9em">This email is sent from a no-reply address. Replies are not monitored.</p>
      `,
      attachments: [
        {
          filename: "YourPlan.pdf",
          content: pdfBase64,
        },
      ],
      reply_to: "no-reply@wearminus.com" // ✅ ensures people can’t reply to gmail
    });

  } catch (err) {
    console.error("Error sending email:", err);
  }
}
