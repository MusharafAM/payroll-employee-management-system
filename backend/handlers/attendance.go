package handlers

import (
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
	"github.com/musharaf/payroll-backend/parsers"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
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

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read uploaded file"})
		return
	}

	var rows [][]string

	// Detect if it is XML SpreadsheetML format
	isXML := false
	headerLen := len(fileBytes)
	if headerLen > 500 {
		headerLen = 500
	}
	headerStr := strings.TrimSpace(string(fileBytes[:headerLen]))
	if strings.HasPrefix(headerStr, "<?xml") || strings.Contains(headerStr, "<Workbook") {
		isXML = true
	}

	if isXML {
		rows, err = parsers.ParseXMLSpreadsheet(fileBytes)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse XML Spreadsheet: " + err.Error()})
			return
		}
	} else {
		// Create a temp file to store uploaded content securely
		tempFile, err := os.CreateTemp("", "attendance-*.xlsx")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create temp file"})
			return
		}
		defer os.Remove(tempFile.Name())
		defer tempFile.Close()

		if _, err := tempFile.Write(fileBytes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
			return
		}

		f, err := excelize.OpenFile(tempFile.Name())
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Excel file: " + err.Error()})
			return
		}
		defer f.Close()

		sheetName := f.GetSheetName(0)
		rows, err = f.GetRows(sheetName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read sheet"})
			return
		}
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

type ManualAttendanceReq struct {
	EmployeeID  string   `json:"employeeId" binding:"required"`
	Date        string   `json:"date" binding:"required"`
	TimeIn      *string  `json:"timeIn"`
	TimeOut     *string  `json:"timeOut"`
	ManualHours *float64 `json:"manualHours"`
}

// CreateOrUpdateManualAttendance handles POST /api/attendance/manual
func CreateOrUpdateManualAttendance(c *gin.Context) {
	var req ManualAttendanceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	parsedDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format (use YYYY-MM-DD)"})
		return
	}
	parsedDate = parsedDate.UTC().Truncate(24 * time.Hour)

	// Fetch user with salary profile
	var user models.User
	if err := database.DB.Preload("SalaryProfile").First(&user, "id = ?", req.EmployeeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}

	var timeInPtr, timeOutPtr *time.Time
	var totalHours float64

	// If clock times are provided
	if req.TimeIn != nil && *req.TimeIn != "" && req.TimeOut != nil && *req.TimeOut != "" {
		inParts := strings.Split(*req.TimeIn, ":")
		outParts := strings.Split(*req.TimeOut, ":")
		if len(inParts) != 2 || len(outParts) != 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "timeIn and timeOut must be in HH:MM format"})
			return
		}
		inH, err1 := strconv.Atoi(inParts[0])
		inM, err2 := strconv.Atoi(inParts[1])
		outH, err3 := strconv.Atoi(outParts[0])
		outM, err4 := strconv.Atoi(outParts[1])
		if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid clock times"})
			return
		}

		inTime := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), inH, inM, 0, 0, time.UTC)
		outTime := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), outH, outM, 0, 0, time.UTC)

		if outTime.Before(inTime) {
			outTime = outTime.Add(24 * time.Hour)
		}

		timeInPtr = &inTime
		timeOutPtr = &outTime
		totalHours = outTime.Sub(inTime).Hours()
	} else if req.ManualHours != nil {
		totalHours = *req.ManualHours
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "either clock times or manualHours must be provided"})
		return
	}

	lunchDeduction := user.SalaryProfile != nil && user.SalaryProfile.IsLunchHourDeduction
	regular, overtime, isHalfDay := parsers.SplitHours(totalHours, lunchDeduction)

	totalHours = math.Round(totalHours*100) / 100

	att := models.Attendance{
		EmployeeID:    user.ID,
		Date:          parsedDate,
		TimeIn:        timeInPtr,
		TimeOut:       timeOutPtr,
		TotalHours:    totalHours,
		RegularHours:  regular,
		OvertimeHours: overtime,
		IsHalfDay:     isHalfDay,
	}

	var existing models.Attendance
	err = database.DB.Where("employee_id = ? AND date = ?", user.ID, parsedDate).First(&existing).Error
	if err == nil {
		att.ID = existing.ID
		att.CreatedAt = existing.CreatedAt
		att.UpdatedAt = time.Now()
		if err := database.DB.Save(&att).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update attendance record"})
			return
		}
	} else if err == gorm.ErrRecordNotFound {
		att.CreatedAt = time.Now()
		att.UpdatedAt = time.Now()
		if err := database.DB.Create(&att).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create attendance record"})
			return
		}
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Attendance record saved successfully", "attendance": att})
}

// DeleteAttendance handles DELETE /api/attendance/:id
func DeleteAttendance(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Attendance{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete attendance record"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Attendance record deleted successfully"})
}
