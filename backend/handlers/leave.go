package handlers

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
	"github.com/musharaf/payroll-backend/services"
)

// GetLeaveBalance returns entitlement, used (approved only), and remaining for a given year.
func GetLeaveBalance(c *gin.Context) {
	id := c.Param("id")
	year := time.Now().Year()
	if y := c.Query("year"); y != "" {
		if parsed, err := strconv.Atoi(y); err == nil {
			year = parsed
		}
	}

	var user models.User
	if err := database.DB.First(&user, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}

	startOfYear := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	endOfYear := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC)

	var records []models.LeaveRecord
	database.DB.Where("employee_id = ? AND status = 'approved' AND date >= ? AND date < ?", id, startOfYear, endOfYear).Find(&records)

	usedDays := 0.0
	for _, r := range records {
		usedDays += r.Days
	}

	c.JSON(http.StatusOK, gin.H{
		"year":        year,
		"entitlement": user.AnnualLeaveEntitlement,
		"used":        usedDays,
		"remaining":   float64(user.AnnualLeaveEntitlement) - usedDays,
	})
}

// ListLeaves returns all leave records for an employee, optionally filtered by year.
func ListLeaves(c *gin.Context) {
	id := c.Param("id")

	q := database.DB.Where("employee_id = ?", id)
	if y := c.Query("year"); y != "" {
		if year, err := strconv.Atoi(y); err == nil {
			startOfYear := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
			endOfYear := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC)
			q = q.Where("date >= ? AND date < ?", startOfYear, endOfYear)
		}
	}

	var records []models.LeaveRecord
	q.Order("date desc").Find(&records)

	c.JSON(http.StatusOK, gin.H{"leaves": records})
}

// CreateLeave adds a leave record directly (admin only). Auto-approved.
func CreateLeave(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Date   string  `json:"date" binding:"required"`
		Days   float64 `json:"days"`
		Reason string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, use YYYY-MM-DD"})
		return
	}

	days := req.Days
	if days <= 0 {
		days = 1.0
	}

	reviewerEmail, _ := c.Get("userEmail")
	now := time.Now()

	record := models.LeaveRecord{
		EmployeeID: id,
		Date:       date,
		Days:       days,
		Reason:     req.Reason,
		Status:     "approved",
		ReviewedBy: reviewerEmail.(string),
		ReviewedAt: &now,
	}
	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create leave record"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"leave": record})
}

// RequestLeave lets an employee submit a leave request (status = pending).
func RequestLeave(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Date   string  `json:"date" binding:"required"`
		Days   float64 `json:"days"`
		Reason string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, use YYYY-MM-DD"})
		return
	}

	days := req.Days
	if days <= 0 {
		days = 1.0
	}

	record := models.LeaveRecord{
		EmployeeID: id,
		Date:       date,
		Days:       days,
		Reason:     req.Reason,
		Status:     "pending",
	}
	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to submit leave request"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"leave": record})
}

// GetPendingLeaveRequests returns all pending leave requests across all employees.
func GetPendingLeaveRequests(c *gin.Context) {
	var records []models.LeaveRecord
	database.DB.Where("status = 'pending'").Order("created_at asc").Find(&records)

	// Collect unique employee IDs and fetch in one query
	idSet := map[string]bool{}
	for _, r := range records {
		idSet[r.EmployeeID] = true
	}
	ids := make([]string, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}

	empMap := map[string]*models.User{}
	if len(ids) > 0 {
		var employees []models.User
		database.DB.Where("id IN ?", ids).Find(&employees)
		for i := range employees {
			empMap[employees[i].ID] = &employees[i]
		}
	}

	for i := range records {
		records[i].Employee = empMap[records[i].EmployeeID]
	}

	c.JSON(http.StatusOK, gin.H{"requests": records, "count": len(records)})
}

// ApproveLeave marks a leave request as approved.
func ApproveLeave(c *gin.Context) {
	id := c.Param("id")

	var record models.LeaveRecord
	if err := database.DB.First(&record, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "leave record not found"})
		return
	}

	reviewerEmail, _ := c.Get("userEmail")
	now := time.Now()

	if err := database.DB.Model(&record).Updates(map[string]interface{}{
		"status":      "approved",
		"reviewed_by": reviewerEmail.(string),
		"reviewed_at": now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to approve leave"})
		return
	}

	// Notify employee via email (non-blocking)
	go func() {
		var emp models.User
		if database.DB.First(&emp, "id = ?", record.EmployeeID).Error == nil && emp.Email != "" {
			if err := services.SendLeaveStatusEmail(emp.Email, emp.Name, "approved", record.Date.Format("2006-01-02"), ""); err != nil {
				log.Printf("leave approval email failed for %s: %v", emp.Email, err)
			}
		}
	}()

	c.JSON(http.StatusOK, gin.H{"leave": record})
}

// RejectLeave marks a leave request as rejected with an optional reason.
func RejectLeave(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	var record models.LeaveRecord
	if err := database.DB.First(&record, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "leave record not found"})
		return
	}

	reviewerEmail, _ := c.Get("userEmail")
	now := time.Now()

	if err := database.DB.Model(&record).Updates(map[string]interface{}{
		"status":           "rejected",
		"rejection_reason": req.Reason,
		"reviewed_by":      reviewerEmail.(string),
		"reviewed_at":      now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reject leave"})
		return
	}

	// Notify employee via email (non-blocking)
	go func() {
		var emp models.User
		if database.DB.First(&emp, "id = ?", record.EmployeeID).Error == nil && emp.Email != "" {
			if err := services.SendLeaveStatusEmail(emp.Email, emp.Name, "rejected", record.Date.Format("2006-01-02"), req.Reason); err != nil {
				log.Printf("leave rejection email failed for %s: %v", emp.Email, err)
			}
		}
	}()

	c.JSON(http.StatusOK, gin.H{"leave": record})
}

// DeleteLeave removes a leave record by its own ID.
func DeleteLeave(c *gin.Context) {
	id := c.Param("id")

	var record models.LeaveRecord
	if err := database.DB.First(&record, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "leave record not found"})
		return
	}
	if err := database.DB.Delete(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete leave record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "leave record deleted"})
}

// UpdateLeaveEntitlement sets the annual leave days entitlement for an employee.
func UpdateLeaveEntitlement(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		AnnualLeaveEntitlement int `json:"annualLeaveEntitlement"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.AnnualLeaveEntitlement < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "entitlement cannot be negative"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}
	if err := database.DB.Model(&user).Update("annual_leave_entitlement", req.AnnualLeaveEntitlement).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update entitlement"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"annualLeaveEntitlement": req.AnnualLeaveEntitlement})
}
