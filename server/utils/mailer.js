const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (email, otp) => {
  await resend.emails.send({
    from: "CareerCompass AI <onboarding@resend.dev>",
    to: email,
    subject: "Verify your email – CareerCompass AI",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#3b6ef8;margin-bottom:8px;">CareerCompass AI</h2>
        <p style="color:#374151;">Your one-time verification code is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#111827;margin:24px 0;">${otp}</div>
        <p style="color:#6b7280;font-size:13px;">This code expires in <b>10 minutes</b>. Do not share it with anyone.</p>
      </div>
    `,
  });
};

module.exports = { sendOTPEmail };