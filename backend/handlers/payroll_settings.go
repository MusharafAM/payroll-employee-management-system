package handlers

import (
	"net/http"

	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
)

// GetPayrollSettings returns all admin-configurable payroll rules.
func GetPayrollSettings(w http.ResponseWriter, r *http.Request) {
	var settings []models.PayrollSettings
	if err := database.DB.Order("key").Find(&settings).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch payroll settings"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"settings": settings})
}

type updateSettingRequest struct {
	Value       *float64 `json:"value"`
	Description *string  `json:"description"`
}

// UpdatePayrollSetting updates a single setting by key.
func UpdatePayrollSetting(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")

	var req updateSettingRequest
	if err := decodeJSON(r, &req); err != nil || req.Value == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "value is required"})
		return
	}

	var setting models.PayrollSettings
	if err := database.DB.Where("key = ?", key).First(&setting).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "setting not found"})
		return
	}

	updates := map[string]any{"value": *req.Value}
	if req.Description != nil {
		updates["description"] = *req.Description
	}

	if err := database.DB.Model(&setting).Updates(updates).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update setting"})
		return
	}

	database.DB.Where("key = ?", key).First(&setting)
	writeJSON(w, http.StatusOK, map[string]any{"setting": setting})
}
