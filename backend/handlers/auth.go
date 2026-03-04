package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
)

type syncUserRequest struct {
	Email string `json:"email" binding:"required,email"`
	Name  string `json:"name" binding:"required"`
}

// SyncUser creates or updates the DB user record after Asgardeo login.
// Called once from the frontend right after a successful login.
func SyncUser(c *gin.Context) {
	var req syncUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	roleStr, _ := c.Get("userRole")
	role := models.Role(fmt.Sprintf("%v", roleStr))

	var user models.User
	err := database.DB.Where("email = ?", req.Email).First(&user).Error

	if err != nil {
		// New user — auto-generate an employee ID they can update later
		employeeID := generateEmployeeID(req.Email)
		user = models.User{
			Email:      req.Email,
			Name:       req.Name,
			EmployeeID: employeeID,
			Role:       role,
			IsActive:   true,
		}
		if err := database.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}

		// Create an empty salary profile for this new user
		profile := models.SalaryProfile{
			UserID:               user.ID,
			IsLunchHourDeduction: true,
			AdditionalAllowances: models.JSONBMap{},
		}
		database.DB.Create(&profile)
	} else {
		// Existing user — keep their DB role, just sync display name from Asgardeo
		database.DB.Model(&user).Update("name", req.Name)
	}

	// Return user with salary profile attached
	database.DB.Preload("SalaryProfile").First(&user, "id = ?", user.ID)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// GetCurrentUser returns the authenticated user's full DB record including salary profile.
func GetCurrentUser(c *gin.Context) {
	email, _ := c.Get("userEmail")

	var user models.User
	if err := database.DB.Preload("SalaryProfile").Where("email = ?", email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found — please call /auth/sync-user first"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

// generateEmployeeID creates a short unique ID from the email prefix + timestamp.
func generateEmployeeID(email string) string {
	prefix := strings.ToUpper(strings.Split(email, "@")[0])
	if len(prefix) > 4 {
		prefix = prefix[:4]
	}
	suffix := fmt.Sprintf("%d", time.Now().UnixMilli()%10000)
	return fmt.Sprintf("EMP-%s-%s", prefix, suffix)
}
