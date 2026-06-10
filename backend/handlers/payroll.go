package handlers

import (
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
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

// calculateEmployeePayroll performs the payroll math for a single employee and month
func calculateEmployeePayroll(tx *gorm.DB, emp models.User, month string, settings []models.PayrollSettings) (models.Payroll, error) {
	// Parse settings
	otMultiplier := getSettingValue(settings, "overtime_multiplier", 1.5)
	epfEmployeeRate := getSettingValue(settings, "epf_employee_rate", 8.0)
	epfEmployerRate := getSettingValue(settings, "epf_employer_rate", 12.0)
	etfRate := getSettingValue(settings, "etf_rate", 3.0)

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

	for _, a := range attendances {
		regularHours += a.RegularHours
		overtimeHours += a.OvertimeHours
	}

	profile := emp.SalaryProfile
	if profile == nil {
		// Default empty profile fallback
		profile = &models.SalaryProfile{}
	}

	baseSalary := profile.BaseSalary
	hourlyRate := profile.HourlyRate

	// Overtime Pay
	overtimePay := overtimeHours * hourlyRate * otMultiplier

	// Travel Allowance daily component * workDays + fixed travel allowance
	travelAllowance := profile.TravelAllowance*float64(workDays) + profile.TravelAllowanceFixed
	incentiveAllowance := profile.IncentiveAllowance

	// Standard Bonuses
	eidBonus := profile.EidBonus
	hajBonus := profile.HajBonus
	poyaBonus := profile.PoyaBonus
	targetBonus := profile.TargetBonus
	attendanceBonus := profile.AttendanceBonus

	// Sum any additional allowances
	var additionalAllowancesSum float64
	if profile.AdditionalAllowances != nil {
		for _, val := range profile.AdditionalAllowances {
			additionalAllowancesSum += val
		}
	}

	// Regular Pay is Base Salary
	regularPay := baseSalary

	// Gross Salary
	grossSalary := regularPay + overtimePay + travelAllowance + incentiveAllowance +
		eidBonus + hajBonus + poyaBonus + targetBonus + attendanceBonus + additionalAllowancesSum

	// Deductions
	epf8 := grossSalary * (epfEmployeeRate / 100)
	epf12 := grossSalary * (epfEmployerRate / 100)
	etf3 := grossSalary * (etfRate / 100)

	// Salary advances / loans (default to 0 unless fetched/stored elsewhere in future features)
	salaryAdvance := 0.0
	loan := 0.0

	totalDeductions := epf8 + salaryAdvance + loan
	netSalary := grossSalary - totalDeductions

	return models.Payroll{
		EmployeeID:           emp.ID,
		Month:                month,
		WorkDays:             workDays,
		RegularHours:         round2(regularHours),
		OvertimeHours:        round2(overtimeHours),
		BaseSalary:           round2(baseSalary),
		RegularPay:           round2(regularPay),
		OvertimePay:          round2(overtimePay),
		TravelAllowance:      round2(travelAllowance),
		PerformanceAllowance: round2(incentiveAllowance),
		EidBonus:             round2(eidBonus),
		HajBonus:             round2(hajBonus),
		PoyaBonus:            round2(poyaBonus),
		TargetBonus:          round2(targetBonus),
		AttendanceBonus:      round2(attendanceBonus),
		OtherBonus:           round2(additionalAllowancesSum),
		GrossSalary:          round2(grossSalary),
		EPF8:                 round2(epf8),
		EPF12:                round2(epf12),
		ETF3:                 round2(etf3),
		SalaryAdvance:        round2(salaryAdvance),
		Loan:                 round2(loan),
		TotalDeductions:      round2(totalDeductions),
		NetSalary:            round2(netSalary),
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
