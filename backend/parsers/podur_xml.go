package parsers

import (
	"encoding/xml"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/musharaf/payroll-backend/models"
	"gorm.io/gorm"
)

var (
	podurYearRe = regexp.MustCompile(`\b20\d{2}\b`)
)

// XMLWorkbook represents the top-level SpreadsheetML element
type XMLWorkbook struct {
	XMLName    xml.Name       `xml:"Workbook"`
	Worksheets []XMLWorksheet `xml:"Worksheet"`
}

type XMLWorksheet struct {
	Name  string   `xml:"Name,attr"`
	Table XMLTable `xml:"Table"`
}

type XMLTable struct {
	Rows []XMLRow `xml:"Row"`
}

type XMLRow struct {
	Cells []XMLCell `xml:"Cell"`
}

type XMLCell struct {
	Index       int     `xml:"Index,attr"`
	MergeAcross int     `xml:"MergeAcross,attr"`
	Data        XMLData `xml:"Data"`
}

type XMLData struct {
	Type  string `xml:"Type,attr"`
	Value string `xml:",chardata"`
}

// ParseXMLSpreadsheet parses raw XML SpreadsheetML bytes into [][]string matrix
func ParseXMLSpreadsheet(data []byte) ([][]string, error) {
	var wb XMLWorkbook
	if err := xml.Unmarshal(data, &wb); err != nil {
		return nil, fmt.Errorf("failed to unmarshal SpreadsheetML XML: %w", err)
	}

	if len(wb.Worksheets) == 0 {
		return nil, fmt.Errorf("no worksheets found in SpreadsheetML file")
	}

	// We use the first worksheet
	ws := wb.Worksheets[0]
	var rows [][]string

	for _, r := range ws.Table.Rows {
		var row []string
		colIdx := 0 // 0-based column index in the output row

		for _, c := range r.Cells {
			// If ss:Index is specified, skip to that column
			if c.Index > 0 {
				targetColIdx := c.Index - 1
				for len(row) < targetColIdx {
					row = append(row, "")
				}
				colIdx = targetColIdx
			}

			// Append cell data
			val := c.Data.Value
			if len(row) <= colIdx {
				row = append(row, val)
			} else {
				row[colIdx] = val
			}

			// If MergeAcross is specified, append empty values for the merged columns
			if c.MergeAcross > 0 {
				for m := 0; m < c.MergeAcross; m++ {
					row = append(row, "")
				}
				colIdx += c.MergeAcross
			}

			colIdx++
		}
		rows = append(rows, row)
	}

	return rows, nil
}

type PodurXMLParser struct{}

func init() {
	Register(&PodurXMLParser{})
}

func (p *PodurXMLParser) Name() string {
	return "podur_biometric"
}

func (p *PodurXMLParser) Description() string {
	return "PODUR Biometric Fingerprint XML Spreadsheet"
}

func (p *PodurXMLParser) Supports(rows [][]string) bool {
	if len(rows) < 5 {
		return false
	}
	// Check if "Time Card Report" is in the first row
	for _, col := range rows[0] {
		if strings.Contains(strings.ToLower(col), "time card report") {
			return true
		}
	}
	// Check if any of the first few rows have "ID:"
	for i := 0; i < 5 && i < len(rows); i++ {
		for _, col := range rows[i] {
			if strings.HasPrefix(strings.TrimSpace(col), "ID:") {
				return true
			}
		}
	}
	return false
}

func (p *PodurXMLParser) Parse(rows [][]string, db *gorm.DB) (saved int, skipped int, errs []string) {
	var currentEmployee *models.User
	var currentYear string

	// State variables for active day tracking
	var currentDate time.Time
	var firstTimeIn *time.Time
	var lastTimeOut *time.Time
	var accumulatedTotalHours float64
	var hasActiveDay bool

	// Helper to flush (save) the active day record
	flushActiveDay := func(rowIndex int) {
		if !hasActiveDay || currentEmployee == nil {
			return
		}

		lunchDeduction := currentEmployee.SalaryProfile != nil && currentEmployee.SalaryProfile.IsLunchHourDeduction
		regular, overtime, isHalfDay := SplitHours(accumulatedTotalHours, lunchDeduction)

		att := models.Attendance{
			EmployeeID:    currentEmployee.ID,
			Date:          currentDate,
			TimeIn:        firstTimeIn,
			TimeOut:       lastTimeOut,
			TotalHours:    math.Round(accumulatedTotalHours*100) / 100,
			RegularHours:  regular,
			OvertimeHours: overtime,
			IsHalfDay:     isHalfDay,
		}

		if err := upsertAttendance(db, att); err != nil {
			errs = append(errs, fmt.Sprintf("row %d: DB error: %v", rowIndex, err))
			skipped++
		} else {
			saved++
		}
		hasActiveDay = false
	}

	for i, row := range rows {
		// Ensure we have at least 14 columns (our grid structure) to avoid out-of-bound panic
		// Pad row if it's shorter
		for len(row) < 14 {
			row = append(row, "")
		}

		// Clean up columns
		for colIdx := range row {
			row[colIdx] = strings.TrimSpace(row[colIdx])
		}

		// --- Employee Header Row Detection ---
		// We look for a cell starting with "ID:" in the columns
		var foundIDCell string
		var foundDateCell string

		if strings.HasPrefix(row[0], "ID:") {
			foundIDCell = row[0]
			foundDateCell = row[8]
		}

		if foundIDCell != "" {
			// Flush previous active day for the old employee
			flushActiveDay(i + 1)

			empID := strings.TrimSpace(strings.TrimPrefix(foundIDCell, "ID:"))
			emp, err := findEmployeeByID(db, empID)
			if err != nil {
				errs = append(errs, fmt.Sprintf("row %d: %v", i+1, err))
				currentEmployee = nil
			} else {
				currentEmployee = emp
			}

			// Extract year from date period cell (e.g. "Date:06/01/2026-06/14/2026")
			currentYear = "2026" // Default fallback
			if match := podurYearRe.FindString(foundDateCell); match != "" {
				currentYear = match
			}

			hasActiveDay = false
			continue
		}

		// If no employee is set, skip processing
		if currentEmployee == nil {
			continue
		}

		// Skip header columns row (e.g. "Date", "Week", "IN", "OUT"...)
		if row[0] == "Date" {
			continue
		}

		// Skip summary rows (e.g., "Total Hours" row)
		if strings.Contains(strings.ToLower(row[0]), "total") || strings.Contains(strings.ToLower(row[11]), "total") {
			flushActiveDay(i + 1)
			continue
		}

		dateCell := row[0]
		inCell := row[2]
		outCell := row[5]
		dailyTotalCell := row[11]

		// Check if it's a new day row (date is populated like "06.13")
		isDateRow := false
		if dateCell != "" && strings.Contains(dateCell, ".") {
			isDateRow = true
		}

		if isDateRow {
			// Flush the previous day's record
			flushActiveDay(i + 1)

			// Parse the new date
			// Format is MM.DD, let's convert to YYYY-MM-DD
			dateParts := strings.Split(dateCell, ".")
			if len(dateParts) == 2 {
				dateStr := fmt.Sprintf("%s-%s-%s", currentYear, dateParts[0], dateParts[1])
				t, err := time.Parse("2006-01-02", dateStr)
				if err != nil {
					errs = append(errs, fmt.Sprintf("row %d: invalid date %q: %v", i+1, dateCell, err))
					continue
				}
				currentDate = t.UTC().Truncate(24 * time.Hour)
			} else {
				errs = append(errs, fmt.Sprintf("row %d: invalid date format %q", i+1, dateCell))
				continue
			}

			// Initialize day state
			firstTimeIn = parseHHMM(currentDate, inCell)
			if outCell != "" && outCell != " " && !strings.Contains(strings.ToLower(outCell), "missing") {
				lastTimeOut = parseHHMM(currentDate, outCell)
			} else {
				lastTimeOut = nil
			}
			accumulatedTotalHours = 0.0

			// Check if daily total is present
			if dailyTotalCell != "" && dailyTotalCell != " " {
				totalHours, err := parseHHMMtoHours(dailyTotalCell)
				if err != nil {
					errs = append(errs, fmt.Sprintf("row %d: invalid daily total %q: %v", i+1, dailyTotalCell, err))
					hasActiveDay = true
				} else {
					accumulatedTotalHours = totalHours
					// Save immediately since Daily Total is present and day is complete
					lunchDeduction := currentEmployee.SalaryProfile != nil && currentEmployee.SalaryProfile.IsLunchHourDeduction
					regular, overtime, isHalfDay := SplitHours(totalHours, lunchDeduction)

					att := models.Attendance{
						EmployeeID:    currentEmployee.ID,
						Date:          currentDate,
						TimeIn:        firstTimeIn,
						TimeOut:       lastTimeOut,
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
					hasActiveDay = false
				}
			} else {
				// Daily total is empty, might be a split shift, wait for next rows to finish
				hasActiveDay = true
			}
		} else {
			// This is a continuation row (blank date, blank week).
			// If it's a split shift row, process IN/OUT times
			if hasActiveDay && (inCell != "" || outCell != "") {
				// Update TimeIn if not set yet
				if firstTimeIn == nil && inCell != "" && inCell != " " {
					firstTimeIn = parseHHMM(currentDate, inCell)
				}
				// Update TimeOut with the latest valid OUT punch
				if outCell != "" && outCell != " " && !strings.Contains(strings.ToLower(outCell), "missing") {
					lastTimeOut = parseHHMM(currentDate, outCell)
				}

				// Check if Daily Total is now present
				if dailyTotalCell != "" && dailyTotalCell != " " {
					totalHours, err := parseHHMMtoHours(dailyTotalCell)
					if err != nil {
						errs = append(errs, fmt.Sprintf("row %d: invalid daily total in continuation %q: %v", i+1, dailyTotalCell, err))
					} else {
						accumulatedTotalHours = totalHours
						// Flush since we got the daily total
						lunchDeduction := currentEmployee.SalaryProfile != nil && currentEmployee.SalaryProfile.IsLunchHourDeduction
						regular, overtime, isHalfDay := SplitHours(totalHours, lunchDeduction)

						att := models.Attendance{
							EmployeeID:    currentEmployee.ID,
							Date:          currentDate,
							TimeIn:        firstTimeIn,
							TimeOut:       lastTimeOut,
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
						hasActiveDay = false
					}
				}
			}
		}
	}

	// Flush any remaining active day
	flushActiveDay(len(rows))

	return saved, skipped, errs
}

// findEmployeeByID finds user by matching employee ID with exact or suffix match
func findEmployeeByID(db *gorm.DB, empID string) (*models.User, error) {
	var user models.User
	if err := db.Preload("SalaryProfile").Where("employee_id = ? OR employee_id LIKE ?", empID, "%"+empID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("employee ID %q not found in DB", empID)
	}
	return &user, nil
}
