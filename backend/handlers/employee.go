package handlers

import (
	"net/http"

	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
	"gorm.io/gorm"
)

func GetAllEmployees(w http.ResponseWriter, r *http.Request) {
	var employees []models.User
	if err := database.DB.Preload("SalaryProfile").Where("is_active = ?", true).Find(&employees).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch employees"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"employees": employees, "count": len(employees)})
}

func GetEmployee(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var employee models.User
	if err := database.DB.Preload("SalaryProfile").First(&employee, "id = ?", id).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "employee not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"employee": employee})
}

type createEmployeeRequest struct {
	EmployeeID           string      `json:"employeeId"`
	Email                string      `json:"email"`
	Name                 string      `json:"name"`
	Role                 models.Role `json:"role"`
	Department           string      `json:"department"`
	Position             string      `json:"position"`
	HourlyRate           float64     `json:"hourlyRate"`
	BaseSalary           float64     `json:"baseSalary"`
	TravelAllowance      float64     `json:"travelAllowance"`
	TravelAllowanceFixed float64     `json:"travelAllowanceFixed"`
	IncentiveAllowance   float64     `json:"incentiveAllowance"`
	EidBonus             float64     `json:"eidBonus"`
	HajBonus             float64     `json:"hajBonus"`
	PoyaBonus            float64     `json:"poyaBonus"`
	TargetBonus          float64     `json:"targetBonus"`
	AttendanceBonus      float64     `json:"attendanceBonus"`
	IsLunchHourDeduction bool        `json:"isLunchHourDeduction"`
}

func CreateEmployee(w http.ResponseWriter, r *http.Request) {
	var req createEmployeeRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.EmployeeID == "" || req.Email == "" || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "employeeId, email, and name are required"})
		return
	}

	role := req.Role
	if role == "" {
		role = models.RoleEmployee
	}

	var employee models.User
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		employee = models.User{
			EmployeeID: req.EmployeeID,
			Email:      req.Email,
			Name:       req.Name,
			Role:       role,
			Department: req.Department,
			Position:   req.Position,
			IsActive:   true,
		}
		if err := tx.Create(&employee).Error; err != nil {
			return err
		}
		profile := models.SalaryProfile{
			UserID:               employee.ID,
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
			AdditionalAllowances: models.JSONBMap{},
		}
		return tx.Create(&profile).Error
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create employee"})
		return
	}

	database.DB.Preload("SalaryProfile").First(&employee, "id = ?", employee.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"employee": employee})
}

type updateEmployeeRequest struct {
	EmployeeID           *string      `json:"employeeId"`
	Name                 *string      `json:"name"`
	Role                 *models.Role `json:"role"`
	Department           *string      `json:"department"`
	Position             *string      `json:"position"`
	IsActive             *bool        `json:"isActive"`
	HourlyRate           *float64     `json:"hourlyRate"`
	BaseSalary           *float64     `json:"baseSalary"`
	TravelAllowance      *float64     `json:"travelAllowance"`
	TravelAllowanceFixed *float64     `json:"travelAllowanceFixed"`
	IncentiveAllowance   *float64     `json:"incentiveAllowance"`
	EidBonus             *float64     `json:"eidBonus"`
	HajBonus             *float64     `json:"hajBonus"`
	PoyaBonus            *float64     `json:"poyaBonus"`
	TargetBonus          *float64     `json:"targetBonus"`
	AttendanceBonus      *float64     `json:"attendanceBonus"`
	IsLunchHourDeduction *bool        `json:"isLunchHourDeduction"`
}

func UpdateEmployee(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var employee models.User
	if err := database.DB.Preload("SalaryProfile").First(&employee, "id = ?", id).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "employee not found"})
		return
	}

	var req updateEmployeeRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	userUpdates := map[string]any{}
	if req.EmployeeID != nil { userUpdates["employee_id"] = *req.EmployeeID }
	if req.Name != nil       { userUpdates["name"] = *req.Name }
	if req.Role != nil       { userUpdates["role"] = *req.Role }
	if req.Department != nil { userUpdates["department"] = *req.Department }
	if req.Position != nil   { userUpdates["position"] = *req.Position }
	if req.IsActive != nil   { userUpdates["is_active"] = *req.IsActive }
	if len(userUpdates) > 0 {
		if err := database.DB.Model(&employee).Updates(userUpdates).Error; err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update employee"})
			return
		}
	}

	profileUpdates := map[string]any{}
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
	if len(profileUpdates) > 0 {
		if employee.SalaryProfile == nil {
			profile := models.SalaryProfile{UserID: employee.ID, AdditionalAllowances: models.JSONBMap{}}
			database.DB.Create(&profile)
			database.DB.Model(&profile).Updates(profileUpdates)
		} else {
			if err := database.DB.Model(employee.SalaryProfile).Updates(profileUpdates).Error; err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update salary profile"})
				return
			}
		}
	}

	database.DB.Preload("SalaryProfile").First(&employee, "id = ?", id)
	writeJSON(w, http.StatusOK, map[string]any{"employee": employee})
}

func DeleteEmployee(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var employee models.User
	if err := database.DB.First(&employee, "id = ?", id).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "employee not found"})
		return
	}
	if err := database.DB.Delete(&employee).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete employee"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "employee deleted"})
}
