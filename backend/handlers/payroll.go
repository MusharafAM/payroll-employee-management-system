package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strings"
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
	var overtime15Hours float64
	var overtime20Hours float64

	profile := emp.SalaryProfile
	if profile == nil {
		// Default empty profile fallback
		profile = &models.SalaryProfile{}
	}

	for _, a := range attendances {
		regularHours += a.RegularHours
		overtimeHours += a.OvertimeHours

		// Calculate 1.5x and 2.0x overtime hours dynamically based on PODUR policy
		lunchDeductionActive := profile.IsLunchHourDeduction
		var dailyOT15 float64
		var dailyOT20 float64

		if lunchDeductionActive {
			if a.TotalHours > 11 {
				dailyOT15 = 2.0
				dailyOT20 = a.TotalHours - 11
			} else if a.TotalHours > 9 {
				dailyOT15 = a.TotalHours - 9
				dailyOT20 = 0.0
			}
		} else {
			if a.TotalHours > 10 {
				dailyOT15 = 2.0
				dailyOT20 = a.TotalHours - 10
			} else if a.TotalHours > 8 {
				dailyOT15 = a.TotalHours - 8
				dailyOT20 = 0.0
			}
		}

		overtime15Hours += dailyOT15
		overtime20Hours += dailyOT20
	}

	baseSalary := profile.BaseSalary
	hourlyRate := profile.HourlyRate

	// Overtime Pay calculation with PODUR tiered rates
	overtimePay := (overtime15Hours * 1.5 * hourlyRate) + (overtime20Hours * 2.0 * hourlyRate)

	// Dynamic Allowances extraction
	var travelAllowance float64
	var incentiveAllowance float64
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
				incentiveAllowance += val
			} else {
				otherBonus += val
			}
		}
	}

	// Regular Pay is Base Salary
	regularPay := baseSalary

	// Gross Salary
	grossSalary := regularPay + overtimePay + travelAllowance + incentiveAllowance +
		eidBonus + hajBonus + poyaBonus + targetBonus + attendanceBonus + otherBonus

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
		Overtime15Hours:      round2(overtime15Hours),
		Overtime20Hours:      round2(overtime20Hours),
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
		OtherBonus:           round2(otherBonus),
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
