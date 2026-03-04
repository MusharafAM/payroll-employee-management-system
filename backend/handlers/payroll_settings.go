package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
)

// GetPayrollSettings returns all admin-configurable payroll rules. Manager/Admin only.
func GetPayrollSettings(c *gin.Context) {
	var settings []models.PayrollSettings
	if err := database.DB.Order("key").Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch payroll settings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

type updateSettingRequest struct {
	Value       *float64 `json:"value" binding:"required"`
	Description *string  `json:"description"`
}

// UpdatePayrollSetting updates a single setting by key. Admin only.
func UpdatePayrollSetting(c *gin.Context) {
	key := c.Param("key")

	var req updateSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var setting models.PayrollSettings
	if err := database.DB.Where("key = ?", key).First(&setting).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "setting not found"})
		return
	}

	updates := map[string]interface{}{"value": *req.Value}
	if req.Description != nil {
		updates["description"] = *req.Description
	}

	if err := database.DB.Model(&setting).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update setting"})
		return
	}

	database.DB.Where("key = ?", key).First(&setting)
	c.JSON(http.StatusOK, gin.H{"setting": setting})
}
