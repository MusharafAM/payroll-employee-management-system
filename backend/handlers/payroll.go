package handlers

import (
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
	"github.com/musharaf/payroll-backend/services"
	"gorm.io/gorm"
)

// Helper helper to get settings value
func getSettingValue(settings []models.PayrollSettings, key string, fallback float64) float64 {
	for _, s := range settings {
		if s.Key == key {
			return s.Value
		}
	}
	return fallback
}

// Helper to round floats to 2 decimal places
func round2(val float64) float64 {
	return math.Round(val*100) / 100
}

// roundToNearest rounds val up to the nearest n (e.g. n=10 → nearest LKR 10, n=1 → no rounding).
func roundToNearest(val float64, n float64) float64 {
	if val <= 0 || n <= 0 {
		return math.Max(0, val)
	}
	return math.Ceil(val/n) * n
}

// calculateEmployeePayroll performs the payroll math for a single employee and month
func calculateEmployeePayroll(tx *gorm.DB, emp models.User, month string, settings []models.PayrollSettings) (models.Payroll, error) {
	// Parse settings
	epfEmployeeRate := getSettingValue(settings, "epf_employee_rate", 8.0)
	epfEmployerRate := getSettingValue(settings, "epf_employer_rate", 12.0)
	etfRate := getSettingValue(settings, "etf_rate", 3.0)
	regularHoursPerDay := getSettingValue(settings, "regular_hours_per_day", 8.0)
	lunchHourOffset := getSettingValue(settings, "lunch_hour_offset", 1.0)
	tier1Multiplier := getSettingValue(settings, "ot_tier1_multiplier", 1.5)
	tier2Multiplier := getSettingValue(settings, "ot_tier2_multiplier", 2.0)
	tier1Window := getSettingValue(settings, "ot_tier1_window_hours", 2.0)
	lunchIncentivePerDay := getSettingValue(settings, "lunch_incentive_per_day", 0.5)
	roundNearest := getSettingValue(settings, "round_to_nearest", 10.0)
	rnd := func(v float64) float64 { return roundToNearest(v, roundNearest) }

	// Fetch attendances for this employee in the given month
	var attendances []models.Attendance
	query := tx.Where("employee_id = ?", emp.ID)
	t, err := time.Parse("2006-01", month)
	if err == nil {
		query = query.Where("date >= ? AND date < ?", t, t.AddDate(0, 1, 0))
	} else {
		return models.Payroll{}, fmt.Errorf("invalid month format (use YYYY-MM): %w", err)
	}

	if err := query.Find(&attendances).Error; err != nil {
		return models.Payroll{}, err
	}

	workDays := len(attendances)
	var regularHours float64
	var overtimeHours float64
	var overtime15Hours float64
	var overtime20Hours float64
	var lunchIncentiveHours float64

	profile := emp.SalaryProfile
	if profile == nil {
		profile = &models.SalaryProfile{}
	}

	lunchDeductionActive := profile.IsLunchHourDeduction

	// OT threshold: shift up by lunchHourOffset when lunch deduction is active
	otThreshold := regularHoursPerDay
	if lunchDeductionActive {
		otThreshold += lunchHourOffset
	}
	tier2Start := otThreshold + tier1Window

	for _, a := range attendances {
		regularHours += a.RegularHours
		overtimeHours += a.OvertimeHours

		var dailyOT15, dailyOT20 float64
		if a.TotalHours > tier2Start {
			dailyOT15 = tier1Window
			dailyOT20 = a.TotalHours - tier2Start
		} else if a.TotalHours > otThreshold {
			dailyOT15 = a.TotalHours - otThreshold
		}

		overtime15Hours += dailyOT15
		overtime20Hours += dailyOT20

		if a.TotalHours > 0 && lunchDeductionActive {
			lunchIncentiveHours += lunchIncentivePerDay
		}
	}

	baseSalary := profile.BaseSalary
	hourlyRate := profile.HourlyRate

	overtimePay := (overtime15Hours * tier1Multiplier * hourlyRate) + (overtime20Hours * tier2Multiplier * hourlyRate)

	// Lunch Incentive calculation
	lunchIncentive := lunchIncentiveHours * hourlyRate

	// Performance Allowance calculation based on actual hours worked: regularTimeHours * hourlyRate - baseSalary
	regularTimeSalary := regularHours * hourlyRate
	var performanceAllowance float64
	if regularTimeSalary > baseSalary {
		performanceAllowance = regularTimeSalary - baseSalary
	}

	// Dynamic Allowances extraction
	var travelAllowance float64
	var staticAllowances float64
	var eidBonus float64
	var hajBonus float64
	var poyaBonus float64
	var targetBonus float64
	var attendanceBonus float64
	var otherBonus float64

	if profile.AdditionalAllowances != nil {
		for key, val := range profile.AdditionalAllowances {
			lowerKey := strings.ToLower(key)
			if strings.Contains(lowerKey, "travel") {
				if strings.Contains(lowerKey, "daily") || strings.Contains(lowerKey, "per day") || strings.Contains(lowerKey, "variable") {
					travelAllowance += val * float64(workDays)
				} else {
					travelAllowance += val
				}
			} else if strings.Contains(lowerKey, "eid") {
				eidBonus += val
			} else if strings.Contains(lowerKey, "haj") {
				hajBonus += val
			} else if strings.Contains(lowerKey, "poya") {
				poyaBonus += val
			} else if strings.Contains(lowerKey, "target") {
				targetBonus += val
			} else if strings.Contains(lowerKey, "attendance") {
				attendanceBonus += val
			} else if strings.Contains(lowerKey, "incentive") || strings.Contains(lowerKey, "performance") {
				staticAllowances += val
			} else {
				otherBonus += val
			}
		}
	}

	// Dynamic static allowances go into otherBonus to avoid conflict with the calculated performanceAllowance
	otherBonus += staticAllowances

	// Regular Pay is Base Salary (guaranteed floor)
	regularPay := baseSalary

	// Deductions (Calculated on baseSalary instead of grossSalary to match existing system)
	epf8 := baseSalary * (epfEmployeeRate / 100)
	epf12 := baseSalary * (epfEmployerRate / 100)
	etf3 := baseSalary * (etfRate / 100)

	// Salary advance for this specific month
	var advance models.SalaryAdvance
	salaryAdvance := 0.0
	if tx.Where("employee_id = ? AND month = ?", emp.ID, month).First(&advance).Error == nil {
		salaryAdvance = advance.Amount
	}

	// Active loan installment (only if loan has started by this month)
	var activeLoan models.Loan
	loanDeduction := 0.0
	if tx.Where("employee_id = ? AND status = ? AND start_month <= ?", emp.ID, "active", month).First(&activeLoan).Error == nil {
		loanDeduction = math.Min(activeLoan.MonthlyInstallment, activeLoan.RemainingBalance)
	}

	// Round all monetary values according to the round_to_nearest setting
	baseSalaryRounded := rnd(baseSalary)
	regularPayRounded := rnd(regularPay)
	overtimePayRounded := rnd(overtimePay)
	travelAllowanceRounded := rnd(travelAllowance)
	performanceAllowanceRounded := rnd(performanceAllowance)
	lunchIncentiveRounded := rnd(lunchIncentive)
	eidBonusRounded := rnd(eidBonus)
	hajBonusRounded := rnd(hajBonus)
	poyaBonusRounded := rnd(poyaBonus)
	targetBonusRounded := rnd(targetBonus)
	attendanceBonusRounded := rnd(attendanceBonus)
	otherBonusRounded := rnd(otherBonus)

	grossSalary := regularPayRounded + overtimePayRounded + travelAllowanceRounded +
		performanceAllowanceRounded + lunchIncentiveRounded + eidBonusRounded +
		hajBonusRounded + poyaBonusRounded + targetBonusRounded + attendanceBonusRounded +
		otherBonusRounded
	grossSalaryRounded := rnd(grossSalary)

	epf8Rounded := rnd(epf8)
	epf12Rounded := rnd(epf12)
	etf3Rounded := rnd(etf3)
	salaryAdvanceRounded := rnd(salaryAdvance)
	loanRounded := rnd(loanDeduction)

	totalDeductions := epf8Rounded + salaryAdvanceRounded + loanRounded
	totalDeductionsRounded := rnd(totalDeductions)

	netSalary := grossSalaryRounded - totalDeductionsRounded
	netSalaryRounded := rnd(netSalary)

	return models.Payroll{
		EmployeeID:           emp.ID,
		Month:                month,
		WorkDays:             workDays,
		RegularHours:         round2(regularHours),
		OvertimeHours:        round2(overtimeHours),
		Overtime15Hours:      round2(overtime15Hours),
		Overtime20Hours:      round2(overtime20Hours),
		LunchIncentiveHours:  round2(lunchIncentiveHours),
		BaseSalary:           baseSalaryRounded,
		RegularPay:           regularPayRounded,
		OvertimePay:          overtimePayRounded,
		LunchIncentive:       lunchIncentiveRounded,
		PerformanceAllowance: performanceAllowanceRounded,
		TravelAllowance:      travelAllowanceRounded,
		EidBonus:             eidBonusRounded,
		HajBonus:             hajBonusRounded,
		PoyaBonus:            poyaBonusRounded,
		TargetBonus:          targetBonusRounded,
		AttendanceBonus:      attendanceBonusRounded,
		OtherBonus:           otherBonusRounded,
		GrossSalary:          grossSalaryRounded,
		EPF8:                 epf8Rounded,
		EPF12:                epf12Rounded,
		ETF3:                 etf3Rounded,
		SalaryAdvance:        salaryAdvanceRounded,
		Loan:                 loanRounded,
		TotalDeductions:      totalDeductionsRounded,
		NetSalary:            netSalaryRounded,
		GeneratedAt:          time.Now(),
	}, nil
}

// CalculatePayroll calculates payroll records in memory for all active employees (GET /api/payroll/calculate)
func CalculatePayroll(c *gin.Context) {
	month := c.Query("month")
	if month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month parameter is required (format: YYYY-MM)"})
		return
	}

	// Get payroll settings
	var settings []models.PayrollSettings
	if err := database.DB.Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch settings"})
		return
	}

	// Get all active employees with salary profiles
	var employees []models.User
	if err := database.DB.Preload("SalaryProfile").Where("is_active = ?", true).Find(&employees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch employees"})
		return
	}

	var payslips []models.Payroll
	var totalGross, totalNet, totalEpfEmployer, totalEtfEmployer float64

	for _, emp := range employees {
		payslip, err := calculateEmployeePayroll(database.DB, emp, month, settings)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "calculation failed for employee " + emp.Name + ": " + err.Error()})
			return
		}
		empCopy := emp
		payslip.Employee = &empCopy
		payslips = append(payslips, payslip)

		totalGross += payslip.GrossSalary
		totalNet += payslip.NetSalary
		totalEpfEmployer += payslip.EPF12
		totalEtfEmployer += payslip.ETF3
	}

	c.JSON(http.StatusOK, gin.H{
		"month":            month,
		"totalGross":       round2(totalGross),
		"totalNet":         round2(totalNet),
		"totalEpfEmployer": round2(totalEpfEmployer),
		"totalEtfEmployer": round2(totalEtfEmployer),
		"payslips":         payslips,
	})
}

// SavePayroll saves calculated payroll records to the database (POST /api/payroll/save)
func SavePayroll(c *gin.Context) {
	var req struct {
		Month string `json:"month" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get payroll settings
	var settings []models.PayrollSettings
	if err := database.DB.Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch settings"})
		return
	}

	// Get all active employees with salary profiles
	var employees []models.User
	if err := database.DB.Preload("SalaryProfile").Where("is_active = ?", true).Find(&employees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch employees"})
		return
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		for _, emp := range employees {
			payslip, err := calculateEmployeePayroll(tx, emp, req.Month, settings)
			if err != nil {
				return err
			}

			// Check if payroll record already exists for this employee and month
			var existing models.Payroll
			res := tx.Where("employee_id = ? AND month = ?", emp.ID, req.Month).First(&existing)

			if res.Error == nil {
				// Update existing
				payslip.ID = existing.ID
				payslip.CreatedAt = existing.CreatedAt
				payslip.UpdatedAt = time.Now()
				if err := tx.Save(&payslip).Error; err != nil {
					return err
				}
			} else if res.Error == gorm.ErrRecordNotFound {
				// Create new
				payslip.CreatedAt = time.Now()
				payslip.UpdatedAt = time.Now()
				if err := tx.Create(&payslip).Error; err != nil {
					return err
				}
			} else {
				return res.Error
			}

			// Reduce active loan balance now that payroll is finalized
			if payslip.Loan > 0 {
				var activeLoan models.Loan
				if tx.Where("employee_id = ? AND status = ? AND start_month <= ?", emp.ID, "active", req.Month).First(&activeLoan).Error == nil {
					newBalance := activeLoan.RemainingBalance - payslip.Loan
					updates := map[string]interface{}{"remaining_balance": newBalance}
					if newBalance <= 0 {
						updates["status"] = "paid_off"
						updates["remaining_balance"] = 0
					}
					if err := tx.Model(&activeLoan).Updates(updates).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save payroll: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payroll processed and saved successfully for " + req.Month})
}

// GetPayrollHistory returns the processed payroll records from the DB for a given month (GET /api/payroll/history)
func GetPayrollHistory(c *gin.Context) {
	month := c.Query("month")
	if month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month parameter is required (format: YYYY-MM)"})
		return
	}

	var payrolls []models.Payroll
	if err := database.DB.Preload("Employee").Where("month = ?", month).Find(&payrolls).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch payroll history"})
		return
	}

	// Also fetch employee names map to enrich response or just respond with the raw records
	c.JSON(http.StatusOK, gin.H{"month": month, "payrolls": payrolls})
}

// EmailPayslip receives a pre-generated PDF and emails it to the given address (POST /api/payroll/email-payslip)
func EmailPayslip(c *gin.Context) {
	log.Println("[EmailPayslip] handler entered")

	toEmail := c.PostForm("email")
	toName := c.PostForm("name")
	month := c.PostForm("month")
	log.Printf("[EmailPayslip] email=%q name=%q month=%q", toEmail, toName, month)

	if toEmail == "" || month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and month are required"})
		return
	}

	log.Println("[EmailPayslip] reading file...")
	file, err := c.FormFile("payslip")
	if err != nil {
		log.Println("[EmailPayslip] FormFile error:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "payslip PDF file is required: " + err.Error()})
		return
	}
	log.Printf("[EmailPayslip] file received: %s (%d bytes)", file.Filename, file.Size)

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open uploaded file"})
		return
	}
	defer f.Close()

	pdfBytes, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read uploaded file"})
		return
	}
	log.Printf("[EmailPayslip] read %d bytes, sending email...", len(pdfBytes))

	if err := services.SendPayslipEmail(toEmail, toName, month, pdfBytes); err != nil {
		log.Println("[EmailPayslip] SMTP error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send email: " + err.Error()})
		return
	}

	log.Println("[EmailPayslip] email sent successfully")
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("payslip emailed to %s", toEmail)})
}

// GetEmployeePayroll returns a single employee's payroll record for a given month (GET /api/payroll/employee/:id)
func GetEmployeePayroll(c *gin.Context) {
	employeeID := c.Param("id")
	month := c.Query("month")

	if month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month parameter is required (format: YYYY-MM)"})
		return
	}

	var payroll models.Payroll
	if err := database.DB.Preload("Employee").Where("employee_id = ? AND month = ?", employeeID, month).First(&payroll).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "no payroll record found for this employee and month"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch employee payroll"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"payroll": payroll})
}
