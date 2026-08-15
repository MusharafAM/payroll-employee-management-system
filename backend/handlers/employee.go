package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
	"github.com/musharaf/payroll-backend/services"
	"gorm.io/gorm"
)

// GetAllEmployees returns all active employees with their salary profiles.
func GetAllEmployees(c *gin.Context) {
	var employees []models.User
	if err := database.DB.Preload("SalaryProfile").Where("is_active = ?", true).Find(&employees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch employees"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"employees": employees, "count": len(employees)})
}

// GetEmployee returns a single employee with salary profile.
func GetEmployee(c *gin.Context) {
	id := c.Param("id")
	var employee models.User
	if err := database.DB.Preload("SalaryProfile").First(&employee, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"employee": employee})
}

type createEmployeeRequest struct {
	EmployeeID           string          `json:"employeeId" binding:"required"`
	Email                string          `json:"email" binding:"required,email"`
	Name                 string          `json:"name" binding:"required"`
	Role                 models.Role     `json:"role"`
	Department           string          `json:"department"`
	Position             string          `json:"position"`
	Phone                string          `json:"phone"`
	NIC                  string          `json:"nic"`
	DateOfBirth          string          `json:"dateOfBirth"`
	Gender               string          `json:"gender"`
	Address              string          `json:"address"`
	JoinDate             string          `json:"joinDate"`
	EmploymentType       string          `json:"employmentType"`
	EmergencyContactName  string         `json:"emergencyContactName"`
	EmergencyContactPhone string         `json:"emergencyContactPhone"`
	BankName             string          `json:"bankName"`
	BankAccountNumber    string          `json:"bankAccountNumber"`
	BankBranch           string          `json:"bankBranch"`
	SalaryType           string          `json:"salaryType"` // "hourly" | "fixed"
	HourlyRate           float64         `json:"hourlyRate"`
	BaseSalary           float64         `json:"baseSalary"`
	TravelAllowance      float64         `json:"travelAllowance"`
	TravelAllowanceFixed float64         `json:"travelAllowanceFixed"`
	IncentiveAllowance   float64         `json:"incentiveAllowance"`
	EidBonus             float64         `json:"eidBonus"`
	HajBonus             float64         `json:"hajBonus"`
	PoyaBonus            float64         `json:"poyaBonus"`
	TargetBonus          float64         `json:"targetBonus"`
	AttendanceBonus      float64         `json:"attendanceBonus"`
	IsLunchHourDeduction bool            `json:"isLunchHourDeduction"`
	AdditionalAllowances models.JSONBMap `json:"additionalAllowances"`
}

// CreateEmployee creates a new employee and their salary profile in one transaction.
func CreateEmployee(c *gin.Context) {
	var req createEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role := req.Role
	if role == "" {
		role = models.RoleEmployee
	}

	var employee models.User

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var existing models.User
		findErr := tx.Unscoped().Where("email = ?", req.Email).First(&existing).Error

		if findErr == nil {
			// User exists (could be soft-deleted or active). Let's restore and update them.
			employee = existing
			employee.EmployeeID = req.EmployeeID
			employee.Name = req.Name
			employee.Role = role
			employee.Department = req.Department
			employee.Position = req.Position
			employee.Phone = req.Phone
			employee.NIC = req.NIC
			employee.DateOfBirth = req.DateOfBirth
			employee.Gender = req.Gender
			employee.Address = req.Address
			employee.JoinDate = req.JoinDate
			employee.EmploymentType = req.EmploymentType
			employee.EmergencyContactName = req.EmergencyContactName
			employee.EmergencyContactPhone = req.EmergencyContactPhone
			employee.BankName = req.BankName
			employee.BankAccountNumber = req.BankAccountNumber
			employee.BankBranch = req.BankBranch
			employee.IsActive = true
			employee.DeletedAt = gorm.DeletedAt{} // Restore soft-deleted

			// Save updates on user (unscoped to make sure GORM updates the soft-deleted row)
			if err := tx.Unscoped().Save(&employee).Error; err != nil {
				return err
			}

			// Update or create their salary profile
			var profile models.SalaryProfile
			profileErr := tx.Where("user_id = ?", employee.ID).First(&profile).Error
			
			profile.SalaryType = req.SalaryType
			if profile.SalaryType == "" {
				profile.SalaryType = "hourly"
			}
			profile.HourlyRate = req.HourlyRate
			profile.BaseSalary = req.BaseSalary
			profile.TravelAllowance = req.TravelAllowance
			profile.TravelAllowanceFixed = req.TravelAllowanceFixed
			profile.IncentiveAllowance = req.IncentiveAllowance
			profile.EidBonus = req.EidBonus
			profile.HajBonus = req.HajBonus
			profile.PoyaBonus = req.PoyaBonus
			profile.TargetBonus = req.TargetBonus
			profile.AttendanceBonus = req.AttendanceBonus
			profile.IsLunchHourDeduction = req.IsLunchHourDeduction

			if profileErr != nil {
				// Doesn't exist - create
				profile.UserID = employee.ID
				profile.AdditionalAllowances = req.AdditionalAllowances
				if profile.AdditionalAllowances == nil {
					profile.AdditionalAllowances = models.JSONBMap{}
				}
				return tx.Create(&profile).Error
			} else {
				// Exists - save
				profile.AdditionalAllowances = req.AdditionalAllowances
				if profile.AdditionalAllowances == nil {
					profile.AdditionalAllowances = models.JSONBMap{}
				}
				return tx.Save(&profile).Error
			}
		} else {
			// User doesn't exist at all - create brand new
			employee = models.User{
				EmployeeID:            req.EmployeeID,
				Email:                 req.Email,
				Name:                  req.Name,
				Role:                  role,
				Department:            req.Department,
				Position:              req.Position,
				Phone:                 req.Phone,
				NIC:                   req.NIC,
				DateOfBirth:           req.DateOfBirth,
				Gender:                req.Gender,
				Address:               req.Address,
				JoinDate:              req.JoinDate,
				EmploymentType:        req.EmploymentType,
				EmergencyContactName:  req.EmergencyContactName,
				EmergencyContactPhone: req.EmergencyContactPhone,
				BankName:              req.BankName,
				BankAccountNumber:     req.BankAccountNumber,
				BankBranch:            req.BankBranch,
				IsActive:              true,
			}
			if err := tx.Create(&employee).Error; err != nil {
				return err
			}

			salaryType := req.SalaryType
			if salaryType == "" {
				salaryType = "hourly"
			}
			profile := models.SalaryProfile{
				UserID:               employee.ID,
				SalaryType:           salaryType,
				HourlyRate:           req.HourlyRate,
				BaseSalary:           req.BaseSalary,
				TravelAllowance:      req.TravelAllowance,
				TravelAllowanceFixed: req.TravelAllowanceFixed,
				IncentiveAllowance:   req.IncentiveAllowance,
				EidBonus:             req.EidBonus,
				HajBonus:             req.HajBonus,
				PoyaBonus:            req.PoyaBonus,
				TargetBonus:          req.TargetBonus,
				AttendanceBonus:      req.AttendanceBonus,
				IsLunchHourDeduction: req.IsLunchHourDeduction,
				AdditionalAllowances: req.AdditionalAllowances,
			}
			if profile.AdditionalAllowances == nil {
				profile.AdditionalAllowances = models.JSONBMap{}
			}
			return tx.Create(&profile).Error
		}
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create employee"})
		return
	}

	// Return full record with profile
	database.DB.Preload("SalaryProfile").First(&employee, "id = ?", employee.ID)

	// Trigger Asgardeo user provisioning
	if err := services.ProvisionUser(employee.Email, employee.Name); err != nil {
		fmt.Printf("Warning: Failed to provision user in Asgardeo: %v\n", err)
	}

	c.JSON(http.StatusCreated, gin.H{"employee": employee})
}

type updateEmployeeRequest struct {
	EmployeeID            *string          `json:"employeeId"`
	Name                  *string          `json:"name"`
	Role                  *models.Role     `json:"role"`
	Department            *string          `json:"department"`
	Position              *string          `json:"position"`
	Phone                 *string          `json:"phone"`
	NIC                   *string          `json:"nic"`
	DateOfBirth           *string          `json:"dateOfBirth"`
	Gender                *string          `json:"gender"`
	Address               *string          `json:"address"`
	JoinDate              *string          `json:"joinDate"`
	EmploymentType        *string          `json:"employmentType"`
	EmergencyContactName  *string          `json:"emergencyContactName"`
	EmergencyContactPhone *string          `json:"emergencyContactPhone"`
	BankName              *string          `json:"bankName"`
	BankAccountNumber     *string          `json:"bankAccountNumber"`
	BankBranch            *string          `json:"bankBranch"`
	IsActive              *bool            `json:"isActive"`
	SalaryType            *string          `json:"salaryType"`
	HourlyRate            *float64         `json:"hourlyRate"`
	BaseSalary            *float64         `json:"baseSalary"`
	TravelAllowance       *float64         `json:"travelAllowance"`
	TravelAllowanceFixed  *float64         `json:"travelAllowanceFixed"`
	IncentiveAllowance    *float64         `json:"incentiveAllowance"`
	EidBonus              *float64         `json:"eidBonus"`
	HajBonus              *float64         `json:"hajBonus"`
	PoyaBonus             *float64         `json:"poyaBonus"`
	TargetBonus           *float64         `json:"targetBonus"`
	AttendanceBonus       *float64         `json:"attendanceBonus"`
	IsLunchHourDeduction  *bool            `json:"isLunchHourDeduction"`
	AdditionalAllowances  *models.JSONBMap `json:"additionalAllowances"`
}

// UpdateEmployee updates identity and/or salary profile fields. Admin only.
func UpdateEmployee(c *gin.Context) {
	id := c.Param("id")

	var employee models.User
	if err := database.DB.Preload("SalaryProfile").First(&employee, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}

	var req updateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// --- Update User (identity) fields ---
	userUpdates := map[string]interface{}{}
	if req.EmployeeID != nil            { userUpdates["employee_id"] = *req.EmployeeID }
	if req.Name != nil                  { userUpdates["name"] = *req.Name }
	if req.Role != nil                  { userUpdates["role"] = *req.Role }
	if req.Department != nil            { userUpdates["department"] = *req.Department }
	if req.Position != nil              { userUpdates["position"] = *req.Position }
	if req.Phone != nil                 { userUpdates["phone"] = *req.Phone }
	if req.NIC != nil                   { userUpdates["nic"] = *req.NIC }
	if req.DateOfBirth != nil           { userUpdates["date_of_birth"] = *req.DateOfBirth }
	if req.Gender != nil                { userUpdates["gender"] = *req.Gender }
	if req.Address != nil               { userUpdates["address"] = *req.Address }
	if req.JoinDate != nil              { userUpdates["join_date"] = *req.JoinDate }
	if req.EmploymentType != nil        { userUpdates["employment_type"] = *req.EmploymentType }
	if req.EmergencyContactName != nil  { userUpdates["emergency_contact_name"] = *req.EmergencyContactName }
	if req.EmergencyContactPhone != nil { userUpdates["emergency_contact_phone"] = *req.EmergencyContactPhone }
	if req.BankName != nil              { userUpdates["bank_name"] = *req.BankName }
	if req.BankAccountNumber != nil     { userUpdates["bank_account_number"] = *req.BankAccountNumber }
	if req.BankBranch != nil            { userUpdates["bank_branch"] = *req.BankBranch }
	if req.IsActive != nil              { userUpdates["is_active"] = *req.IsActive }

	if len(userUpdates) > 0 {
		if err := database.DB.Model(&employee).Updates(userUpdates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update employee"})
			return
		}
	}

	// --- Update SalaryProfile fields ---
	profileUpdates := map[string]interface{}{}
	if req.SalaryType != nil           { profileUpdates["salary_type"] = *req.SalaryType }
	if req.HourlyRate != nil           { profileUpdates["hourly_rate"] = *req.HourlyRate }
	if req.BaseSalary != nil           { profileUpdates["base_salary"] = *req.BaseSalary }
	if req.TravelAllowance != nil      { profileUpdates["travel_allowance"] = *req.TravelAllowance }
	if req.TravelAllowanceFixed != nil { profileUpdates["travel_allowance_fixed"] = *req.TravelAllowanceFixed }
	if req.IncentiveAllowance != nil   { profileUpdates["incentive_allowance"] = *req.IncentiveAllowance }
	if req.EidBonus != nil             { profileUpdates["eid_bonus"] = *req.EidBonus }
	if req.HajBonus != nil             { profileUpdates["haj_bonus"] = *req.HajBonus }
	if req.PoyaBonus != nil            { profileUpdates["poya_bonus"] = *req.PoyaBonus }
	if req.TargetBonus != nil          { profileUpdates["target_bonus"] = *req.TargetBonus }
	if req.AttendanceBonus != nil      { profileUpdates["attendance_bonus"] = *req.AttendanceBonus }
	if req.IsLunchHourDeduction != nil { profileUpdates["is_lunch_hour_deduction"] = *req.IsLunchHourDeduction }
	if req.AdditionalAllowances != nil { profileUpdates["additional_allowances"] = *req.AdditionalAllowances }

	if len(profileUpdates) > 0 {
		if employee.SalaryProfile == nil {
			// Profile missing — create it now
			profile := models.SalaryProfile{UserID: employee.ID, AdditionalAllowances: models.JSONBMap{}}
			database.DB.Create(&profile)
			database.DB.Model(&profile).Updates(profileUpdates)
		} else {
			if err := database.DB.Model(employee.SalaryProfile).Updates(profileUpdates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update salary profile"})
				return
			}
		}
	}

	// Return fresh full record
	database.DB.Preload("SalaryProfile").First(&employee, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"employee": employee})
}

// DeleteEmployee soft-deletes an employee. Admin only.
func DeleteEmployee(c *gin.Context) {
	id := c.Param("id")

	var employee models.User
	if err := database.DB.First(&employee, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}

	if err := database.DB.Delete(&employee).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete employee"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "employee deleted"})
}
