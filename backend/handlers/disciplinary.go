package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
)

// ListDisciplinary returns all disciplinary records for an employee (GET /api/employees/:id/disciplinary)
func ListDisciplinary(c *gin.Context) {
	employeeID := c.Param("id")
	var records []models.DisciplinaryRecord
	if err := database.DB.Where("employee_id = ?", employeeID).Order("date desc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch disciplinary records"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"records": records})
}

// CreateDisciplinary adds a disciplinary record for an employee (POST /api/employees/:id/disciplinary)
func CreateDisciplinary(c *gin.Context) {
	employeeID := c.Param("id")

	var req struct {
		Type        string `json:"type"        binding:"required"`
		Severity    string `json:"severity"`
		Date        string `json:"date"        binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	severity := req.Severity
	if severity == "" {
		severity = "low"
	}

	issuer, _ := c.Get("userEmail")
	issuerStr, _ := issuer.(string)

	record := models.DisciplinaryRecord{
		EmployeeID:  employeeID,
		Type:        req.Type,
		Severity:    severity,
		Date:        req.Date,
		Description: req.Description,
		IssuedBy:    issuerStr,
	}
	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create disciplinary record"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"record": record})
}

// UpdateDisciplinary edits a disciplinary record (PUT /api/disciplinary/:id)
func UpdateDisciplinary(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Type        string `json:"type"`
		Severity    string `json:"severity"`
		Date        string `json:"date"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var record models.DisciplinaryRecord
	if err := database.DB.First(&record, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}

	updates := map[string]interface{}{}
	if req.Type != "" {
		updates["type"] = req.Type
	}
	if req.Severity != "" {
		updates["severity"] = req.Severity
	}
	if req.Date != "" {
		updates["date"] = req.Date
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}

	if err := database.DB.Model(&record).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update record"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"record": record})
}

// DeleteDisciplinary removes a disciplinary record (DELETE /api/disciplinary/:id)
func DeleteDisciplinary(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.DisciplinaryRecord{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete record"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "record deleted"})
}
