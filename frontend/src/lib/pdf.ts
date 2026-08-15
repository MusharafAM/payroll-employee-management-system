import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Payroll } from './api';

async function buildPayslipPDF(payroll: Payroll, employeeName: string, employeeIdStr: string, department: string, position: string): Promise<{ pdf: jsPDF; filename: string }> {
  // 1. Create a temporary container styled off-screen
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '790px'; // A4 width in pixels at 96 DPI
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.fontFamily = "'Outfit', 'Inter', sans-serif";
  container.style.color = '#1f2937';

  const totalBonuses = 
    (payroll.eidBonus || 0) + 
    (payroll.hajBonus || 0) + 
    (payroll.poyaBonus || 0) + 
    (payroll.targetBonus || 0) + 
    (payroll.attendanceBonus || 0) + 
    (payroll.otherBonus || 0);

  const allowances = (payroll.travelAllowance || 0) + (payroll.performanceAllowance || 0);

  // Sri Lankan currency format
  const formatLKR = (num: number) => {
    return 'LKR ' + (Math.round(num * 100) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const monthFormatted = (() => {
    try {
      const [year, month] = payroll.month.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return payroll.month;
    }
  })();

  // 2. Build the HTML template
  container.innerHTML = `
    <div style="border: 2px solid #e5e7eb; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 24px; font-weight: 900; color: #1e3a8a; margin: 0; letter-spacing: -0.5px;">PODUR PAYROLL SYSTEM</h1>
          <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">Colombo, Sri Lanka • Official Statement</p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; font-weight: 800; background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase;">
            Payslip
          </span>
          <p style="font-size: 12px; font-weight: 700; color: #4b5563; margin: 8px 0 0 0;">${monthFormatted}</p>
        </div>
      </div>

      <!-- Employee Info -->
      <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 8px; padding: 15px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 24px; font-size: 12px;">
        <div>
          <p style="margin: 0; color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase;">Employee Details</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 800; color: #111827;">${employeeName}</p>
          <p style="margin: 2px 0 0 0; font-family: monospace; color: #4b5563;">ID: ${employeeIdStr}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase;">Placement</p>
          <p style="margin: 4px 0 0 0; font-weight: 700; color: #374151;">${department || 'Operations'}</p>
          <p style="margin: 2px 0 0 0; color: #6b7280;">${position || 'Executive'}</p>
        </div>
      </div>

      <!-- Work Summary -->
      <div style="display: flex; gap: 20px; margin-bottom: 24px; font-size: 11px;">
        <div style="flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center;">
          <span style="color: #6b7280; display: block; font-size: 9px; font-weight: 700; text-transform: uppercase;">Days Logged</span>
          <strong style="font-size: 14px; color: #111827;">${payroll.workDays} Days</strong>
        </div>
        <div style="flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center;">
          <span style="color: #6b7280; display: block; font-size: 9px; font-weight: 700; text-transform: uppercase;">Regular Hours</span>
          <strong style="font-size: 14px; color: #111827;">${payroll.regularHours} Hrs</strong>
        </div>
        <div style="flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center;">
          <span style="color: #6b7280; display: block; font-size: 9px; font-weight: 700; text-transform: uppercase;">Overtime Hours</span>
          <strong style="font-size: 14px; color: #7c3aed;">${payroll.overtimeHours} Hrs</strong>
          <span style="color: #6b7280; display: block; font-size: 8px; margin-top: 4px; font-family: monospace;">
            1.5x: ${payroll.overtime15Hours || 0}h | 2x: ${payroll.overtime20Hours || 0}h
          </span>
        </div>
      </div>

      <!-- Financial Table -->
      <div style="display: flex; gap: 20px; margin-bottom: 24px;">
        <!-- Earnings -->
        <div style="flex: 1;">
          <h3 style="font-size: 12px; font-weight: 800; color: #1e3a8a; border-bottom: 2px solid #bfdbfe; padding-bottom: 6px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Earnings Breakdown
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #4b5563;">Basic Monthly Salary</span>
              <span style="font-family: monospace; font-weight: 600;">${formatLKR(payroll.baseSalary)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #4b5563;">Overtime Pay (1.5x & 2x)</span>
              <span style="font-family: monospace; font-weight: 600; color: #7c3aed;">${formatLKR(payroll.overtimePay)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #4b5563;">Department Allowances</span>
              <span style="font-family: monospace; font-weight: 600;">${formatLKR(allowances)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #4b5563;">Target / Festival Bonuses</span>
              <span style="font-family: monospace; font-weight: 600;">${formatLKR(totalBonuses)}</span>
            </div>
          </div>
        </div>

        <!-- Deductions -->
        <div style="flex: 1;">
          <h3 style="font-size: 12px; font-weight: 800; color: #991b1b; border-bottom: 2px solid #fca5a5; padding-bottom: 6px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Deductions
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #4b5563;">EPF Contribution (Employee 8%)</span>
              <span style="font-family: monospace; font-weight: 600; color: #b91c1c;">${formatLKR(payroll.epf8)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #4b5563;">Salary Advance</span>
              <span style="font-family: monospace; font-weight: 600;">${formatLKR(payroll.salaryAdvance)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #4b5563;">Staff Loan Deductions</span>
              <span style="font-family: monospace; font-weight: 600;">${formatLKR(payroll.loan)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Panel -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; width: 320px; font-size: 12px;">
          <span style="color: #4b5563;">Gross Remuneration</span>
          <span style="font-family: monospace; font-weight: 700;">${formatLKR(payroll.grossSalary)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; width: 320px; font-size: 12px; color: #b91c1c;">
          <span>Total Deductions</span>
          <span style="font-family: monospace; font-weight: 700;">- ${formatLKR(payroll.totalDeductions)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; width: 320px; font-size: 14px; font-weight: 900; background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 6px; color: #047857; margin-top: 4px;">
          <span>Net Take Home Pay</span>
          <span style="font-family: monospace;">${formatLKR(payroll.netSalary)}</span>
        </div>
      </div>

      <!-- Statutory Contributions -->
      <div style="background-color: #f3f4f6; border-radius: 6px; padding: 12px; font-size: 11px; margin-bottom: 30px;">
        <p style="margin: 0 0 6px 0; font-weight: 700; color: #4b5563; text-transform: uppercase; font-size: 9px;">Employer Statutory Contributions (Not deducted from salary)</p>
        <div style="display: flex; justify-content: space-between;">
          <span>Employer EPF contribution (12%) : <strong style="font-family: monospace;">${formatLKR(payroll.epf12)}</strong></span>
          <span>Employer ETF contribution (3%) : <strong style="font-family: monospace;">${formatLKR(payroll.etf3)}</strong></span>
        </div>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #d1d5db; padding-top: 24px; color: #4b5563;">
        <div>
          <p style="margin: 0; font-weight: 700;">Finalized & Processed Online</p>
          <p style="margin: 2px 0 0 0; color: #9ca3af;">PODUR Payroll Administration</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-style: italic; color: #9ca3af;">This payslip is system generated.</p>
          <p style="margin: 2px 0 0 0; color: #9ca3af;">No physical signature is required.</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // 3. Render container to canvas
    const canvas = await html2canvas(container, {
      scale: 1.5,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.85);

    // 4. Create A4 PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 dimensions: 210mm x 297mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

    const filename = `Payslip_${employeeName.replace(/\s+/g, '_')}_${payroll.month}.pdf`;
    return { pdf, filename };
  } finally {
    document.body.removeChild(container);
  }
}

export async function downloadPayslipPDF(payroll: Payroll, employeeName: string, employeeIdStr: string, department: string, position: string) {
  try {
    const { pdf, filename } = await buildPayslipPDF(payroll, employeeName, employeeIdStr, department, position);
    pdf.save(filename);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    alert('Error generating payslip PDF.');
  }
}

export async function generatePayslipPDFBlob(payroll: Payroll, employeeName: string, employeeIdStr: string, department: string, position: string): Promise<Blob> {
  const { pdf } = await buildPayslipPDF(payroll, employeeName, employeeIdStr, department, position);
  return pdf.output('blob');
}
