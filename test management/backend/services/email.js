const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function sendInviteEmail({ name, email, role, temporaryPassword }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must be configured');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const escapedName = escapeHtml(name);
  const escapedRole = escapeHtml(role);
  const escapedEmail = escapeHtml(email);
  const escapedPassword = escapeHtml(temporaryPassword);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || SMTP_USER,
    to: email,
    subject: 'Your TestManager invitation',
    text: [
      `Hello ${name},`,
      `An admin invited you to TestManager as a ${role}.`,
      `Username: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      'Sign in using these credentials. You will be required to change your password before continuing.',
      `Sign in: ${appUrl}`,
    ].join('\n\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:560px;margin:auto">
        <h2>You are invited to TestManager</h2>
        <p>Hello ${escapedName},</p>
        <p>An admin invited you to join as a <strong>${escapedRole}</strong>.</p>
        <p><strong>Username:</strong> ${escapedEmail}<br><strong>Temporary password:</strong> ${escapedPassword}</p>
        <p>Sign in with these credentials. You will be required to change your password before continuing.</p>
        <p><a href="${escapeHtml(appUrl)}">Open TestManager</a></p>
      </div>
    `,
  });
}

module.exports = sendInviteEmail;