package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/database"
	"github.com/musharaf/payroll-backend/models"
)

// ─── Salary Advances ─────────────────────────────────────────────────────────

// ListAdvances returns all salary advances for an employee (GET /api/employees/:id/advances)
func ListAdvances(c *gin.Context) {
	employeeID := c.Param("id")
	var advances []models.SalaryAdvance
	if err := database.DB.Where("employee_id = ?", employeeID).Order("month desc").Find(&advances).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch advances"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"advances": advances})
}

// CreateAdvance records a salary advance for an employee (POST /api/employees/:id/advances)
func CreateAdvance(c *gin.Context) {
	employeeID := c.Param("id")

	var req struct {
		Month  string  `json:"month"  binding:"required"`
		Amount float64 `json:"amount" binding:"required,gt=0"`
		Note   string  `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	advance := models.SalaryAdvance{
		EmployeeID: employeeID,
		Month:      req.Month,
		Amount:     req.Amount,
		Note:       req.Note,
	}
	if err := database.DB.Create(&advance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create advance"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"advance": advance})
}

// DeleteAdvance removes a salary advance (DELETE /api/advances/:id)
func DeleteAdvance(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.SalaryAdvance{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete advance"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "advance deleted"})
}

// ─── Loans ───────────────────────────────────────────────────────────────────

// ListLoans returns all loans for an employee (GET /api/employees/:id/loans)
func ListLoans(c *gin.Context) {
	employeeID := c.Param("id")
	var loans []models.Loan
	if err := database.DB.Where("employee_id = ?", employeeID).Order("created_at desc").Find(&loans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch loans"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"loans": loans})
}

// CreateLoan records a new loan for an employee (POST /api/employees/:id/loans)
func CreateLoan(c *gin.Context) {
	employeeID := c.Param("id")

	var req struct {
		TotalAmount        float64 `json:"totalAmount"        binding:"required,gt=0"`
		MonthlyInstallment float64 `json:"monthlyInstallment" binding:"required,gt=0"`
		StartMonth         string  `json:"startMonth"         binding:"required"`
		Note               string  `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	loan := models.Loan{
		EmployeeID:         employeeID,
		TotalAmount:        req.TotalAmount,
		MonthlyInstallment: req.MonthlyInstallment,
		RemainingBalance:   req.TotalAmount,
		StartMonth:         req.StartMonth,
		Status:             "active",
		Note:               req.Note,
	}
	if err := database.DB.Create(&loan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create loan"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"loan": loan})
}

// UpdateLoan edits a loan's monthly installment amount (PUT /api/loans/:id)
func UpdateLoan(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		MonthlyInstallment float64 `json:"monthlyInstallment" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var loan models.Loan
	if err := database.DB.First(&loan, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "loan not found"})
		return
	}

	if err := database.DB.Model(&loan).Update("monthly_installment", req.MonthlyInstallment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update loan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"loan": loan})
}

// DeleteLoan removes a loan (DELETE /api/loans/:id)
func DeleteLoan(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Loan{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete loan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "loan deleted"})
}
