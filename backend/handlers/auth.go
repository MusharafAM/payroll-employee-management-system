package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/middleware"
	"github.com/musharaf/payroll-backend/models"
)

type syncUserRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

// SyncUser creates or updates the DB user record after Asgardeo login.
func SyncUser(w http.ResponseWriter, r *http.Request) {
	var req syncUserRequest
	if err := decodeJSON(r, &req); err != nil || req.Email == "" || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email and name are required"})
		return
	}

	roleStr, _ := r.Context().Value(middleware.ContextKeyRole).(string)
	role := models.Role(roleStr)

	var user models.User
	err := database.DB.Where("email = ?", req.Email).First(&user).Error

	if err != nil {
		employeeID := generateEmployeeID(req.Email)
		user = models.User{
			Email:      req.Email,
			Name:       req.Name,
			EmployeeID: employeeID,
			Role:       role,
			IsActive:   true,
		}
		if err := database.DB.Create(&user).Error; err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create user"})
			return
		}

		profile := models.SalaryProfile{
			UserID:               user.ID,
			IsLunchHourDeduction: true,
			AdditionalAllowances: models.JSONBMap{},
		}
		database.DB.Create(&profile)
	} else {
		database.DB.Model(&user).Update("name", req.Name)
	}

	database.DB.Preload("SalaryProfile").First(&user, "id = ?", user.ID)
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

// GetCurrentUser returns the authenticated user's full record including salary profile.
func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	email, _ := r.Context().Value(middleware.ContextKeyEmail).(string)

	var user models.User
	if err := database.DB.Preload("SalaryProfile").Where("email = ?", email).First(&user).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found — please call /auth/sync-user first"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func generateEmployeeID(email string) string {
	prefix := strings.ToUpper(strings.Split(email, "@")[0])
	if len(prefix) > 4 {
		prefix = prefix[:4]
	}
	suffix := fmt.Sprintf("%d", time.Now().UnixMilli()%10000)
	return fmt.Sprintf("EMP-%s-%s", prefix, suffix)
}
