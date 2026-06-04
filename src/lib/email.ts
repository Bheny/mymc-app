// Email sending — swap the provider body for your chosen service.
// Currently logs to console in development; add RESEND_API_KEY (or similar)
// to .env.local and uncomment the Resend block for production.

export interface ActivationEmailPayload {
  to:           string;
  name:         string;
  tempPassword: string;
  role:         string;
  appUrl:       string;
}

export async function sendActivationEmail(payload: ActivationEmailPayload) {
  const { to, name, tempPassword, role, appUrl } = payload;
  const roleLabel = role.replace(/_/g, " ");

  if (process.env.NODE_ENV === "development") {
    console.log("── Activation email (dev) ──────────────────");
    console.log(`  To:       ${to}`);
    console.log(`  Name:     ${name}`);
    console.log(`  Role:     ${roleLabel}`);
    console.log(`  Temp pw:  ${tempPassword}`);
    console.log(`  App URL:  ${appUrl}/login`);
    console.log("────────────────────────────────────────────");
    return;
  }

  // ── Resend (production) ────────────────────────────────────────────────────
  // Uncomment and install: npm install resend
  //
  // import { Resend } from "resend";
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from:    "mymc <no-reply@yourdomain.com>",
  //   to,
  //   subject: "Your mymc access is ready",
  //   html: activationEmailHtml({ name, roleLabel, to, tempPassword, appUrl }),
  // });
}

function activationEmailHtml({
  name, roleLabel, to, tempPassword, appUrl,
}: {
  name: string; roleLabel: string; to: string; tempPassword: string; appUrl: string;
}) {
  return `
    <p>Hi ${name},</p>
    <p>Your account on <strong>mymc</strong> has been activated with the role of
       <strong>${roleLabel}</strong>.</p>
    <p>
      <strong>Email:</strong> ${to}<br/>
      <strong>Temporary password:</strong> <code>${tempPassword}</code>
    </p>
    <p><a href="${appUrl}/login">Log in to mymc →</a></p>
    <p>You will be asked to set a new password on your first login.</p>
    <p style="color:#888;font-size:12px;">
      If you did not expect this email, contact your church administrator.
    </p>
  `;
}
