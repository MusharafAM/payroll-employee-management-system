package handlers

import (
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
)

// GetAttendanceScore calculates punctuality stats for an employee over a date range
// using the admin-configured shift_start_minutes setting (GET /api/employees/:id/attendance-score)
func GetAttendanceScore(c *gin.Context) {
	employeeID := c.Param("id")
	fromStr := c.Query("from")
	toStr := c.Query("to")

	if fromStr == "" || toStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from and to query params are required (YYYY-MM-DD)"})
		return
	}

	fromDate, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from date"})
		return
	}
	toDate, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to date"})
		return
	}

	// Read configured shift start time (default 08:00 = 480 minutes)
	var setting models.PayrollSettings
	shiftMinutes := 480.0
	if err := database.DB.Where("key = ?", "shift_start_minutes").First(&setting).Error; err == nil {
		shiftMinutes = setting.Value
	}

	var records []models.Attendance
	database.DB.Where(
		"employee_id = ? AND date >= ? AND date <= ?",
		employeeID, fromDate, toDate.Add(24*time.Hour-time.Second),
	).Find(&records)

	totalDays := len(records)
	onTimeDays := 0
	lateDays := 0
	noTimeIn := 0

	for _, a := range records {
		if a.TimeIn == nil {
			noTimeIn++
			continue
		}
		minutesSinceMidnight := float64(a.TimeIn.Hour()*60 + a.TimeIn.Minute())
		if minutesSinceMidnight <= shiftMinutes {
			onTimeDays++
		} else {
			lateDays++
		}
	}

	punctualityPct := 0.0
	if totalDays > 0 {
		punctualityPct = math.Round(float64(onTimeDays)/float64(totalDays)*10000) / 100
	}

	shiftH := int(shiftMinutes) / 60
	shiftM := int(shiftMinutes) % 60

	c.JSON(http.StatusOK, gin.H{
		"totalDays":      totalDays,
		"onTimeDays":     onTimeDays,
		"lateDays":       lateDays,
		"noTimeIn":       noTimeIn,
		"punctualityPct": punctualityPct,
		"shiftStartTime": fmt.Sprintf("%02d:%02d", shiftH, shiftM),
	})
}

// ListAllReviews returns all performance reviews across all employees (GET /api/performance-reviews)
func ListAllReviews(c *gin.Context) {
	var reviews []models.PerformanceReview
	if err := database.DB.Order("review_date desc").Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch reviews"})
		return
	}

	// attach employee names
	type ReviewWithEmployee struct {
		models.PerformanceReview
		Employee *models.User `json:"employee,omitempty"`
	}
	result := make([]ReviewWithEmployee, len(reviews))
	for i, r := range reviews {
		var emp models.User
		database.DB.Select("id, employee_id, name, department, position").First(&emp, "id = ?", r.EmployeeID)
		result[i] = ReviewWithEmployee{PerformanceReview: r, Employee: &emp}
	}

	c.JSON(http.StatusOK, gin.H{"reviews": result})
}

// ListEmployeeReviews returns all reviews for one employee (GET /api/employees/:id/performance-reviews).
// Employees may only fetch their own reviews; managers and admins may fetch any.
func ListEmployeeReviews(c *gin.Context) {
	employeeID := c.Param("id")

	role, _ := c.Get("userRole")
	if role == "EMPLOYEE" {
		email, _ := c.Get("userEmail")
		var self models.User
		if err := database.DB.Select("id").Where("email = ? AND deleted_at IS NULL", email).First(&self).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		if self.ID != employeeID {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	var reviews []models.PerformanceReview
	if err := database.DB.Where("employee_id = ?", employeeID).Order("review_date desc").Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch reviews"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reviews": reviews})
}

// CreatePerformanceReview adds a review for an employee (POST /api/employees/:id/performance-reviews)
func CreatePerformanceReview(c *gin.Context) {
	employeeID := c.Param("id")

	var req struct {
		ReviewPeriod        string   `json:"reviewPeriod"        binding:"required"`
		ReviewDate          string   `json:"reviewDate"          binding:"required"`
		Rating              string   `json:"rating"              binding:"required"`
		Strengths           string   `json:"strengths"`
		AreasForImprovement string   `json:"areasForImprovement"`
		Goals               string   `json:"goals"`
		Notes               string   `json:"notes"`
		Status              string   `json:"status"`
		AttendanceScore     *float64 `json:"attendanceScore"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := req.Status
	if status == "" {
		status = "draft"
	}

	reviewer, _ := c.Get("userEmail")
	reviewerStr, _ := reviewer.(string)

	attendanceScore := 0.0
	if req.AttendanceScore != nil {
		attendanceScore = *req.AttendanceScore
	}

	review := models.PerformanceReview{
		EmployeeID:          employeeID,
		ReviewPeriod:        req.ReviewPeriod,
		ReviewDate:          req.ReviewDate,
		Rating:              req.Rating,
		Strengths:           req.Strengths,
		AreasForImprovement: req.AreasForImprovement,
		Goals:               req.Goals,
		Notes:               req.Notes,
		ReviewedBy:          reviewerStr,
		Status:              status,
		AttendanceScore:     attendanceScore,
	}
	if err := database.DB.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create review"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"review": review})
}

// UpdatePerformanceReview edits a review (PUT /api/performance-reviews/:id)
func UpdatePerformanceReview(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		ReviewPeriod        string   `json:"reviewPeriod"`
		ReviewDate          string   `json:"reviewDate"`
		Rating              string   `json:"rating"`
		Strengths           string   `json:"strengths"`
		AreasForImprovement string   `json:"areasForImprovement"`
		Goals               string   `json:"goals"`
		Notes               string   `json:"notes"`
		Status              string   `json:"status"`
		AttendanceScore     *float64 `json:"attendanceScore"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var review models.PerformanceReview
	if err := database.DB.First(&review, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "review not found"})
		return
	}

	updates := map[string]interface{}{}
	if req.ReviewPeriod != "" {
		updates["review_period"] = req.ReviewPeriod
	}
	if req.ReviewDate != "" {
		updates["review_date"] = req.ReviewDate
	}
	if req.Rating != "" {
		updates["rating"] = req.Rating
	}
	if req.Strengths != "" {
		updates["strengths"] = req.Strengths
	}
	if req.AreasForImprovement != "" {
		updates["areas_for_improvement"] = req.AreasForImprovement
	}
	if req.Goals != "" {
		updates["goals"] = req.Goals
	}
	// notes and status can be cleared (empty string is valid), so update always if present in body
	updates["notes"] = req.Notes
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.AttendanceScore != nil {
		updates["attendance_score"] = *req.AttendanceScore
	}

	if err := database.DB.Model(&review).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update review"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"review": review})
}

// DeletePerformanceReview removes a review (DELETE /api/performance-reviews/:id)
func DeletePerformanceReview(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.PerformanceReview{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete review"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "review deleted"})
}
