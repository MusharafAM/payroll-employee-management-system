package handlers

import (
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
	"github.com/xuri/excelize/v2"
)

// --- XLS format understood from NGTimereport files ---
//
// One sheet "Employee Timecard" with multiple employees stacked vertically.
// Each employee block:
//   Row: "Pay Period" | "" | "" | "01-08-24-31-08-24"
//   Row: "Employee"   | "" | "" | "Full Name\n(ID)"
//   Row: "Date"       | "" | "IN" | "OUT" | "Work Time" | "Daily Total" | "Note"
//   Rows: day data  col[0]=day-name, col[1]=DD-MM-YY, col[2]=IN, col[3]=OUT,
//                   col[4]=session-duration, col[5]=daily-total (only last session)
//   Row: "Total Hours" | "" | "" | "" | "" | "HH:MM"
//
// Split shifts: a day may span multiple rows. Only the LAST row of a day has
// col[5] (Daily Total) filled in. We use that as the authoritative total.

var (
	dayNames = map[string]bool{"MON": true, "TUE": true, "WED": true, "THU": true, "FRI": true, "SAT": true, "SUN": true}
	empIDRe  = regexp.MustCompile(`\((\d+)\)`)
)

// UploadAttendance handles POST /api/attendance/upload (multipart form, field "file").
func UploadAttendance(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to parse form"})
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file field is required"})
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid Excel file: " + err.Error()})
		return
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	rows, err := f.GetRows(sheetName)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read sheet"})
		return
	}

	saved, skipped, parseErrors := parseAndSaveAttendance(rows)

	writeJSON(w, http.StatusOK, map[string]any{
		"message": fmt.Sprintf("done: %d records saved, %d skipped", saved, skipped),
		"saved":   saved,
		"skipped": skipped,
		"errors":  parseErrors,
	})
}

// parseAndSaveAttendance processes all rows from the NGTimereport sheet.
func parseAndSaveAttendance(rows [][]string) (saved, skipped int, errs []string) {
	var currentEmployee *models.User
	var currentDate time.Time
	var currentTimeIn *time.Time
	hasDate := false

	for i, row := range rows {
		col := make([]string, 7)
		for j := 0; j < len(row) && j < 7; j++ {
			col[j] = strings.TrimSpace(row[j])
		}

		if col[0] == "Employee" && col[3] != "" {
			emp, err := findEmployee(col[3])
			if err != nil {
				errs = append(errs, fmt.Sprintf("row %d: %v", i+1, err))
				currentEmployee = nil
			} else {
				currentEmployee = emp
			}
			hasDate = false
			continue
		}

		if currentEmployee == nil {
			continue
		}

		if dayNames[strings.ToUpper(col[0])] && col[1] != "" {
			date, err := parseXLSDate(col[1])
			if err != nil {
				errs = append(errs, fmt.Sprintf("row %d: bad date %q: %v", i+1, col[1], err))
				hasDate = false
				continue
			}
			currentDate = date
			hasDate = true
			currentTimeIn = parseHHMM(currentDate, col[2])
		}

		if hasDate && col[5] != "" {
			totalHours, err := parseHHMMtoHours(col[5])
			if err != nil {
				errs = append(errs, fmt.Sprintf("row %d: bad daily total %q: %v", i+1, col[5], err))
				continue
			}

			timeOut := parseHHMM(currentDate, col[3])
			lunchDeduction := currentEmployee.SalaryProfile != nil && currentEmployee.SalaryProfile.IsLunchHourDeduction
			regular, overtime, isHalfDay := splitHours(totalHours, lunchDeduction)

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

			if err := upsertAttendance(att); err != nil {
				errs = append(errs, fmt.Sprintf("row %d: DB error: %v", i+1, err))
				skipped++
			} else {
				saved++
			}
			hasDate = false
		}
	}
	return
}

// findEmployee looks up an employee by the ID embedded in the name cell.
// Format: "Full Name\n(ID)"  e.g. "M Sujivamalkanthi\n(6)"
func findEmployee(cell string) (*models.User, error) {
	m := empIDRe.FindStringSubmatch(cell)
	if m == nil {
		return nil, fmt.Errorf("could not extract employee ID from %q", cell)
	}
	empID := m[1]

	var user models.User
	if err := database.DB.Preload("SalaryProfile").Where("employee_id = ?", empID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("employee ID %q not found in DB", empID)
	}
	return &user, nil
}

// upsertAttendance creates or updates an attendance record for employee+date.
func upsertAttendance(a models.Attendance) error {
	var existing models.Attendance
	err := database.DB.Where("employee_id = ? AND date = ?", a.EmployeeID, a.Date).First(&existing).Error
	if err == nil {
		return database.DB.Model(&existing).Updates(map[string]any{
			"time_in":        a.TimeIn,
			"time_out":       a.TimeOut,
			"total_hours":    a.TotalHours,
			"regular_hours":  a.RegularHours,
			"overtime_hours": a.OvertimeHours,
			"is_half_day":    a.IsHalfDay,
		}).Error
	}
	return database.DB.Create(&a).Error
}

// GetEmployeeAttendance returns attendance for an employee, optionally filtered by month=YYYY-MM.
func GetEmployeeAttendance(w http.ResponseWriter, r *http.Request) {
	employeeID := r.PathValue("id")
	month := r.URL.Query().Get("month")

	query := database.DB.Where("employee_id = ?", employeeID).Order("date ASC")
	if month != "" {
		t, err := time.Parse("2006-01", month)
		if err == nil {
			query = query.Where("date >= ? AND date < ?", t, t.AddDate(0, 1, 0))
		}
	}

	var records []models.Attendance
	if err := query.Find(&records).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch attendance"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"attendance": records, "count": len(records)})
}

// --- helpers ---

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

func splitHours(raw float64, lunchDeduction bool) (float64, float64, bool) {
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
