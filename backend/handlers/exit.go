package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
)

// GetExitSettlement previews the settlement for an employee without creating a record
// (GET /api/employees/:id/exit-settlement)
func GetExitSettlement(c *gin.Context) {
	employeeID := c.Param("id")

	var emp models.User
	if err := database.DB.Preload("SalaryProfile").First(&emp, "id = ?", employeeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}

	leaveRemaining, outstandingLoans := calcSettlementComponents(employeeID, &emp)

	dailyRate := 0.0
	if emp.SalaryProfile != nil && emp.SalaryProfile.BaseSalary > 0 {
		dailyRate = emp.SalaryProfile.BaseSalary / 22
	}

	c.JSON(http.StatusOK, gin.H{
		"leaveRemainingDays": leaveRemaining,
		"dailyRate":          round2(dailyRate),
		"leavePayoutAmount":  round2(leaveRemaining * dailyRate),
		"outstandingLoans":   round2(outstandingLoans),
	})
}

// ListAllExits returns all exit records across employees (GET /api/exits)
func ListAllExits(c *gin.Context) {
	var exits []models.ExitRecord
	if err := database.DB.Order("created_at desc").Find(&exits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch exit records"})
		return
	}

	// Load employees
	idSet := map[string]bool{}
	for _, r := range exits {
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
	for i := range exits {
		exits[i].Employee = empMap[exits[i].EmployeeID]
	}

	c.JSON(http.StatusOK, gin.H{"exits": exits})
}

// GetEmployeeExit returns the most recent exit record for an employee (GET /api/employees/:id/exit)
func GetEmployeeExit(c *gin.Context) {
	employeeID := c.Param("id")
	var exit models.ExitRecord
	if err := database.DB.Where("employee_id = ?", employeeID).Order("created_at desc").First(&exit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no exit record found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"exit": exit})
}

// CreateExit initiates an exit record for an employee (POST /api/employees/:id/exit)
func CreateExit(c *gin.Context) {
	employeeID := c.Param("id")

	var req struct {
		ExitType           string  `json:"exitType"           binding:"required"`
		NoticeDate         string  `json:"noticeDate"`
		LastWorkingDay     string  `json:"lastWorkingDay"`
		Reason             string  `json:"reason"`
		LeavePayoutElected bool    `json:"leavePayoutElected"`
		GratuityAmount     float64 `json:"gratuityAmount"`
		Notes              string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var emp models.User
	if err := database.DB.Preload("SalaryProfile").First(&emp, "id = ?", employeeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}

	leaveRemaining, outstandingLoans := calcSettlementComponents(employeeID, &emp)

	leavePayoutAmount := 0.0
	if req.LeavePayoutElected && emp.SalaryProfile != nil && emp.SalaryProfile.BaseSalary > 0 {
		dailyRate := emp.SalaryProfile.BaseSalary / 22
		leavePayoutAmount = round2(leaveRemaining * dailyRate)
	}

	totalSettlement := round2(leavePayoutAmount + req.GratuityAmount - outstandingLoans)

	exit := models.ExitRecord{
		EmployeeID:         employeeID,
		ExitType:           req.ExitType,
		NoticeDate:         req.NoticeDate,
		LastWorkingDay:     req.LastWorkingDay,
		Reason:             req.Reason,
		Status:             "pending",
		LeaveRemainingDays: leaveRemaining,
		LeavePayoutElected: req.LeavePayoutElected,
		LeavePayoutAmount:  leavePayoutAmount,
		OutstandingLoans:   round2(outstandingLoans),
		GratuityAmount:     round2(req.GratuityAmount),
		TotalSettlement:    totalSettlement,
		Notes:              req.Notes,
	}
	if err := database.DB.Create(&exit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create exit record"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"exit": exit})
}

// UpdateExit edits an exit record (PUT /api/exits/:id)
func UpdateExit(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		ExitType           string  `json:"exitType"`
		NoticeDate         string  `json:"noticeDate"`
		LastWorkingDay     string  `json:"lastWorkingDay"`
		Reason             string  `json:"reason"`
		LeavePayoutElected *bool   `json:"leavePayoutElected"`
		GratuityAmount     float64 `json:"gratuityAmount"`
		Notes              string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exit models.ExitRecord
	if err := database.DB.First(&exit, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exit record not found"})
		return
	}

	// Recalculate settlement if leave payout or gratuity changed
	var emp models.User
	database.DB.Preload("SalaryProfile").First(&emp, "id = ?", exit.EmployeeID)

	leaveRemaining, outstandingLoans := calcSettlementComponents(exit.EmployeeID, &emp)

	elected := exit.LeavePayoutElected
	if req.LeavePayoutElected != nil {
		elected = *req.LeavePayoutElected
	}
	gratuity := req.GratuityAmount

	leavePayoutAmount := 0.0
	if elected && emp.SalaryProfile != nil && emp.SalaryProfile.BaseSalary > 0 {
		dailyRate := emp.SalaryProfile.BaseSalary / 22
		leavePayoutAmount = round2(leaveRemaining * dailyRate)
	}

	updates := map[string]interface{}{
		"leave_remaining_days": leaveRemaining,
		"leave_payout_elected": elected,
		"leave_payout_amount":  leavePayoutAmount,
		"outstanding_loans":    round2(outstandingLoans),
		"gratuity_amount":      round2(gratuity),
		"total_settlement":     round2(leavePayoutAmount + gratuity - outstandingLoans),
	}
	if req.ExitType != "" {
		updates["exit_type"] = req.ExitType
	}
	if req.NoticeDate != "" {
		updates["notice_date"] = req.NoticeDate
	}
	if req.LastWorkingDay != "" {
		updates["last_working_day"] = req.LastWorkingDay
	}
	if req.Reason != "" {
		updates["reason"] = req.Reason
	}
	if req.Notes != "" {
		updates["notes"] = req.Notes
	}

	if err := database.DB.Model(&exit).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update exit record"})
		return
	}
	database.DB.First(&exit, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"exit": exit})
}

// ApproveExit marks an exit record as approved (PUT /api/exits/:id/approve)
func ApproveExit(c *gin.Context) {
	id := c.Param("id")

	var exit models.ExitRecord
	if err := database.DB.First(&exit, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exit record not found"})
		return
	}

	approver, _ := c.Get("userEmail")
	approverStr, _ := approver.(string)
	now := time.Now()

	if err := database.DB.Model(&exit).Updates(map[string]interface{}{
		"status":      "approved",
		"approved_by": approverStr,
		"approved_at": now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to approve exit"})
		return
	}
	database.DB.First(&exit, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"exit": exit})
}

// CompleteExit marks an exit as completed and deactivates the employee (PUT /api/exits/:id/complete)
func CompleteExit(c *gin.Context) {
	id := c.Param("id")

	var exit models.ExitRecord
	if err := database.DB.First(&exit, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exit record not found"})
		return
	}

	now := time.Now()
	if err := database.DB.Model(&exit).Updates(map[string]interface{}{
		"status":       "completed",
		"completed_at": now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete exit"})
		return
	}

	// Deactivate the employee
	database.DB.Model(&models.User{}).Where("id = ?", exit.EmployeeID).Update("is_active", false)

	database.DB.First(&exit, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"exit": exit})
}

// DeleteExit removes an exit record (DELETE /api/exits/:id)
func DeleteExit(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.ExitRecord{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete exit record"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "exit record deleted"})
}

// calcSettlementComponents returns (leaveRemainingDays, outstandingLoans) for an employee.
func calcSettlementComponents(employeeID string, emp *models.User) (leaveRemaining float64, outstandingLoans float64) {
	year := time.Now().Year()
	startOfYear := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	endOfYear := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC)

	var leaveRecords []models.LeaveRecord
	database.DB.Where("employee_id = ? AND status = 'approved' AND date >= ? AND date < ?",
		employeeID, startOfYear, endOfYear).Find(&leaveRecords)

	usedDays := 0.0
	for _, r := range leaveRecords {
		usedDays += r.Days
	}
	leaveRemaining = float64(emp.AnnualLeaveEntitlement) - usedDays
	if leaveRemaining < 0 {
		leaveRemaining = 0
	}

	var loans []models.Loan
	database.DB.Where("employee_id = ? AND status = 'active'", employeeID).Find(&loans)
	for _, l := range loans {
		outstandingLoans += l.RemainingBalance
	}

	return
}
