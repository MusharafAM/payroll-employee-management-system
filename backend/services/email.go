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

// SendNotificationEmail sends a simple notification email (no attachment).
func SendNotificationEmail(toEmail, toName, subject, bodyHTML string) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("SMTP_FROM")

	if host == "" || user == "" || pass == "" {
		return fmt.Errorf("SMTP configuration incomplete")
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
	m.Subject(subject)
	m.SetBodyString(gomail.TypeTextHTML, bodyHTML)

	c, err := gomail.NewClient(host,
		gomail.WithPort(port),
		gomail.WithSMTPAuth(gomail.SMTPAuthPlain),
		gomail.WithUsername(user),
		gomail.WithPassword(pass),
		gomail.WithTimeout(30*time.Second),
	)
	if err != nil {
		return fmt.Errorf("failed to create mail client: %w", err)
	}
	return c.DialAndSend(m)
}

func SendLeaveStatusEmail(toEmail, toName, status, leaveDate, rejectionReason string) error {
	var subject, bodyHTML string
	if status == "approved" {
		subject = "Your Leave Request Has Been Approved — PODUR Payroll"
		bodyHTML = leaveStatusEmailHTML(toName, leaveDate, "approved", "")
	} else {
		subject = "Your Leave Request Has Been Rejected — PODUR Payroll"
		bodyHTML = leaveStatusEmailHTML(toName, leaveDate, "rejected", rejectionReason)
	}
	return SendNotificationEmail(toEmail, toName, subject, bodyHTML)
}

func SendPayslipReadyEmail(toEmail, toName, month string) error {
	subject := fmt.Sprintf("Your Payslip for %s Is Ready — PODUR Payroll", month)
	bodyHTML := payslipReadyEmailHTML(toName, month)
	return SendNotificationEmail(toEmail, toName, subject, bodyHTML)
}

func SendLoanBalanceLowEmail(toEmail, toName string, remainingBalance float64) error {
	subject := "Loan Balance Update — PODUR Payroll"
	bodyHTML := loanBalanceLowEmailHTML(toName, remainingBalance)
	return SendNotificationEmail(toEmail, toName, subject, bodyHTML)
}

func leaveStatusEmailHTML(name, leaveDate, status, rejectionReason string) string {
	var statusBlock string
	if status == "approved" {
		statusBlock = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;font-size:13px;color:#15803d;">
      ✅ Your leave request has been <strong>approved</strong>.
    </div>`
	} else {
		reason := rejectionReason
		if reason == "" {
			reason = "No reason provided."
		}
		statusBlock = fmt.Sprintf(`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;font-size:13px;color:#dc2626;">
      ❌ Your leave request has been <strong>rejected</strong>.<br/>
      <span style="color:#6b7280;font-size:12px;margin-top:6px;display:block;">Reason: %s</span>
    </div>`, reason)
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1e3a8a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;">PODUR PAYROLL SYSTEM</h1>
      <p style="color:#93c5fd;margin:4px 0 0 0;font-size:12px;">Colombo, Sri Lanka</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px 0;">Hi <strong>%s</strong>,</p>
      <p style="color:#4b5563;font-size:14px;margin:0 0 20px 0;">Your leave request for <strong>%s</strong> has been reviewed.</p>
      %s
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;">
      PODUR Payroll System · Confidential
    </div>
  </div>
</body>
</html>`, name, leaveDate, statusBlock)
}

func payslipReadyEmailHTML(name, month string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1e3a8a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;">PODUR PAYROLL SYSTEM</h1>
      <p style="color:#93c5fd;margin:4px 0 0 0;font-size:12px;">Colombo, Sri Lanka</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 16px 0;">Hi <strong>%s</strong>,</p>
      <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
        Your payslip for <strong>%s</strong> is now ready. Please log in to the PODUR Payroll portal to view and download it.
      </p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;font-size:13px;color:#1d4ed8;">
        📋 Log in to view your payslip details, earnings breakdown, and deductions.
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;">
      PODUR Payroll System · Confidential — for recipient use only
    </div>
  </div>
</body>
</html>`, name, month)
}

func loanBalanceLowEmailHTML(name string, remainingBalance float64) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1e3a8a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;">PODUR PAYROLL SYSTEM</h1>
      <p style="color:#93c5fd;margin:4px 0 0 0;font-size:12px;">Colombo, Sri Lanka</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 16px 0;">Hi <strong>%s</strong>,</p>
      <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
        Your loan balance is now <strong>LKR %.2f</strong>. This will be fully paid off with your next salary deduction.
      </p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;font-size:13px;color:#b45309;">
        💡 Your loan will be marked as paid off once the final installment is processed.
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;">
      PODUR Payroll System · Confidential
    </div>
  </div>
</body>
</html>`, name, remainingBalance)
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
