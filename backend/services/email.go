package services

import (
	"bytes"
	"fmt"
	"os"
	"strconv"
	"time"

	gomail "github.com/wneessen/go-mail"
)

func SendPayslipEmail(toEmail, toName, month string, pdfBytes []byte) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("SMTP_FROM")

	if host == "" || user == "" || pass == "" {
		return fmt.Errorf("SMTP configuration incomplete: set SMTP_HOST, SMTP_USER, SMTP_PASS")
	}

	port, _ := strconv.Atoi(portStr)
	if port == 0 {
		port = 587
	}

	m := gomail.NewMsg()
	if err := m.FromFormat("PODUR Payroll", from); err != nil {
		return fmt.Errorf("invalid SMTP_FROM address: %w", err)
	}
	if err := m.To(toEmail); err != nil {
		return fmt.Errorf("invalid recipient address: %w", err)
	}
	m.Subject(fmt.Sprintf("Your Payslip for %s — PODUR Payroll", month))
	m.SetBodyString(gomail.TypeTextHTML, payslipEmailHTML(toName, month))

	filename := fmt.Sprintf("Payslip_%s_%s.pdf", toName, month)
	if err := m.AttachReader(filename, bytes.NewReader(pdfBytes)); err != nil {
		return fmt.Errorf("failed to attach PDF: %w", err)
	}

	c, err := gomail.NewClient(host,
		gomail.WithPort(port),
		gomail.WithSMTPAuth(gomail.SMTPAuthPlain),
		gomail.WithUsername(user),
		gomail.WithPassword(pass),
		gomail.WithTimeout(60*time.Second),
	)
	if err != nil {
		return fmt.Errorf("failed to create mail client: %w", err)
	}

	return c.DialAndSend(m)
}

func payslipEmailHTML(name, month string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1e3a8a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;letter-spacing:-0.5px;">PODUR PAYROLL SYSTEM</h1>
      <p style="color:#93c5fd;margin:4px 0 0 0;font-size:12px;">Colombo, Sri Lanka</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 16px 0;">Hi <strong>%s</strong>,</p>
      <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
        Your payslip for <strong>%s</strong> is attached to this email as a PDF.
        Please review it and contact HR if you have any questions.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;font-size:13px;color:#15803d;">
        This is a system-generated email from PODUR Payroll Administration. No reply is required.
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;">
      PODUR Payroll System · Confidential — for recipient use only
    </div>
  </div>
</body>
</html>`, name, month)
}
