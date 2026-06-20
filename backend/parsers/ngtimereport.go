package parsers

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/musharaf/payroll-backend/models"
	"gorm.io/gorm"
)

var (
	dayNames  = map[string]bool{"MON": true, "TUE": true, "WED": true, "THU": true, "FRI": true, "SAT": true, "SUN": true}
	empIDRe  = regexp.MustCompile(`\(([^)]+)\)`)
)

type NGTimeReportParser struct{}

func init() {
	Register(&NGTimeReportParser{})
}

func (n *NGTimeReportParser) Name() string {
	return "ngtimereport"
}

func (n *NGTimeReportParser) Description() string {
	return "NGTimereport standard vertical employee timecard"
}

func (n *NGTimeReportParser) Supports(rows [][]string) bool {
	if len(rows) < 5 {
		return false
	}
	// Supports format if "Employee Timecard" or "Pay Period" headers exist in early rows
	for i := 0; i < 5 && i < len(rows); i++ {
		for _, col := range rows[i] {
			colTrimmed := strings.ToLower(strings.TrimSpace(col))
			if strings.Contains(colTrimmed, "pay period") || strings.Contains(colTrimmed, "employee timecard") {
				return true
			}
		}
	}
	return false
}

func (n *NGTimeReportParser) Parse(rows [][]string, db *gorm.DB) (saved int, skipped int, errs []string) {
	var currentEmployee *models.User
	var currentDate time.Time
	var currentTimeIn *time.Time
	hasDate := false

	for i, row := range rows {
		col := make([]string, 7)
		for j := 0; j < len(row) && j < 7; j++ {
			col[j] = strings.TrimSpace(row[j])
		}

		// --- Employee header row ---
		if col[0] == "Employee" && col[3] != "" {
			emp, err := findEmployee(db, col[3])
			if err != nil {
				errs = append(errs, fmt.Sprintf("row %d: %v", i+1, err))
				currentEmployee = nil
			} else {
				currentEmployee = emp
			}
			hasDate = false
			continue
		}

		// Nothing to do without a known employee
		if currentEmployee == nil {
			continue
		}

		// --- Day row: starts a new date ---
		if dayNames[strings.ToUpper(col[0])] && col[1] != "" {
			date, err := parseXLSDate(col[1])
			if err != nil {
				errs = append(errs, fmt.Sprintf("row %d: bad date %q: %v", i+1, col[1], err))
				hasDate = false
				continue
			}
			currentDate = date
			hasDate = true

			// Record the first Time-In for this day
			currentTimeIn = parseHHMM(currentDate, col[2])
		}

		// --- Any row (day or continuation) with a Daily Total ---
		if hasDate && col[5] != "" {
			totalHours, err := parseHHMMtoHours(col[5])
			if err != nil {
				errs = append(errs, fmt.Sprintf("row %d: bad daily total %q: %v", i+1, col[5], err))
				continue
			}

			timeOut := parseHHMM(currentDate, col[3])
			lunchDeduction := currentEmployee.SalaryProfile != nil && currentEmployee.SalaryProfile.IsLunchHourDeduction
			regular, overtime, isHalfDay := SplitHours(totalHours, lunchDeduction)

			att := models.Attendance{
				EmployeeID:    currentEmployee.ID,
				Date:          currentDate,
				TimeIn:        currentTimeIn,
				TimeOut:       timeOut,
				TotalHours:    math.Round(totalHours*100) / 100,
				RegularHours:  regular,
				OvertimeHours: overtime,
				IsHalfDay:     isHalfDay,
			}

			if err := upsertAttendance(db, att); err != nil {
				errs = append(errs, fmt.Sprintf("row %d: DB error: %v", i+1, err))
				skipped++
			} else {
				saved++
			}
			hasDate = false // consumed — wait for next day row
		}
	}
	return saved, skipped, errs
}

// --- Helper Functions ---

func findEmployee(db *gorm.DB, cell string) (*models.User, error) {
	m := empIDRe.FindStringSubmatch(cell)
	if m == nil {
		return nil, fmt.Errorf("could not extract employee ID from %q", cell)
	}
	empID := m[1]

	var user models.User
	// Check for exact match or suffix match (e.g. searching for "2876" matches "EMP-EMPL-2876")
	if err := db.Preload("SalaryProfile").Where("employee_id = ? OR employee_id LIKE ?", empID, "%"+empID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("employee ID %q not found in DB", empID)
	}
	return &user, nil
}

func upsertAttendance(db *gorm.DB, a models.Attendance) error {
	var existing models.Attendance
	err := db.Where("employee_id = ? AND date = ?", a.EmployeeID, a.Date).First(&existing).Error
	if err == nil {
		return db.Model(&existing).Updates(map[string]interface{}{
			"time_in":        a.TimeIn,
			"time_out":       a.TimeOut,
			"total_hours":    a.TotalHours,
			"regular_hours":  a.RegularHours,
			"overtime_hours": a.OvertimeHours,
			"is_half_day":    a.IsHalfDay,
		}).Error
	}
	return db.Create(&a).Error
}

func parseXLSDate(s string) (time.Time, error) {
	t, err := time.Parse("02-01-06", s)
	if err != nil {
		return time.Time{}, err
	}
	return t.UTC().Truncate(24 * time.Hour), nil
}

func parseHHMM(date time.Time, s string) *time.Time {
	if s == "" {
		return nil
	}
	parts := strings.SplitN(s, ":", 2)
	if len(parts) != 2 {
		return nil
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return nil
	}
	t := time.Date(date.Year(), date.Month(), date.Day(), h, m, 0, 0, time.UTC)
	return &t
}

func parseHHMMtoHours(s string) (float64, error) {
	parts := strings.SplitN(s, ":", 2)
	if len(parts) != 2 {
		return 0, fmt.Errorf("expected HH:MM, got %q", s)
	}
	h, err1 := strconv.ParseFloat(parts[0], 64)
	m, err2 := strconv.ParseFloat(parts[1], 64)
	if err1 != nil || err2 != nil {
		return 0, fmt.Errorf("non-numeric in %q", s)
	}
	return h + m/60, nil
}

func SplitHours(raw float64, lunchDeduction bool) (float64, float64, bool) {
	isHalfDay := raw < 4
	var regular, overtime float64

	if lunchDeduction {
		if raw > 9 {
			overtime = raw - 9
			regular = 8
		} else {
			regular = raw - 1
			if regular < 0 {
				regular = 0
			}
			if regular > 8 {
				regular = 8
			}
		}
	} else {
		if raw > 8 {
			overtime = raw - 8
			regular = 8
		} else {
			regular = raw
		}
	}

	round := func(v float64) float64 { return math.Round(v*100) / 100 }
	return round(regular), round(overtime), isHalfDay
}
