package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
	"github.com/musharaf/payroll-backend/parsers"
	"github.com/xuri/excelize/v2"
)

// UploadAttendance handles POST /api/attendance/upload (multipart form, field "file", optional query "?format=ngtimereport").
func UploadAttendance(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field is required"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not open uploaded file"})
		return
	}
	defer src.Close()

	f, err := excelize.OpenReader(src)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Excel file: " + err.Error()})
		return
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	rows, err := f.GetRows(sheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read sheet"})
		return
	}

	var parser parsers.AttendanceParser

	// 1. Check if format is explicitly chosen in the request query parameter
	format := c.Query("format")
	if format != "" {
		parser, err = parsers.Get(format)
	} else {
		// 2. Otherwise, auto-detect the parser from the spreadsheet content
		parser, err = parsers.Detect(rows)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 3. Run the matched parser against the DB transaction
	saved, skipped, parseErrors := parser.Parse(rows, database.DB)

	c.JSON(http.StatusOK, gin.H{
		"message":     "Upload processed",
		"parser_used": parser.Name(),
		"saved":       saved,
		"skipped":     skipped,
		"errors":      parseErrors,
	})
}

// GetEmployeeAttendance returns attendance for an employee, optionally filtered by month=YYYY-MM.
func GetEmployeeAttendance(c *gin.Context) {
	employeeID := c.Param("id")
	month := c.Query("month")

	query := database.DB.Where("employee_id = ?", employeeID).Order("date ASC")
	if month != "" {
		t, err := time.Parse("2006-01", month)
		if err == nil {
			query = query.Where("date >= ? AND date < ?", t, t.AddDate(0, 1, 0))
		}
	}

	var records []models.Attendance
	if err := query.Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch attendance"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"attendance": records, "count": len(records)})
}
