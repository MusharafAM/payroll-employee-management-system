package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/musharaf/payroll-backend/handlers"
	"github.com/musharaf/payroll-backend/middleware"
)

func SetupRoutes(router *gin.Engine) {
	api := router.Group("/api")

	// --- Auth ---
	auth := api.Group("/auth")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.POST("/sync-user", handlers.SyncUser)
		auth.GET("/me", handlers.GetCurrentUser)
	}

	// --- Employees ---
	employees := api.Group("/employees")
	employees.Use(middleware.AuthMiddleware())
	{
		employees.GET("", middleware.ManagerOrAdmin(), handlers.GetAllEmployees)
		employees.GET("/:id", handlers.GetEmployee)
		employees.POST("", middleware.AdminOnly(), handlers.CreateEmployee)
		employees.PUT("/:id", middleware.AdminOnly(), handlers.UpdateEmployee)
		employees.DELETE("/:id", middleware.AdminOnly(), handlers.DeleteEmployee)
		employees.GET("/:id/advances", middleware.ManagerOrAdmin(), handlers.ListAdvances)
		employees.POST("/:id/advances", middleware.AdminOnly(), handlers.CreateAdvance)
		employees.GET("/:id/loans", middleware.ManagerOrAdmin(), handlers.ListLoans)
		employees.POST("/:id/loans", middleware.AdminOnly(), handlers.CreateLoan)
	}

	// --- Attendance ---
	attendance := api.Group("/attendance")
	attendance.Use(middleware.AuthMiddleware())
	{
		attendance.POST("/upload", middleware.ManagerOrAdmin(), handlers.UploadAttendance)
		attendance.GET("/employee/:id", handlers.GetEmployeeAttendance)
		attendance.POST("/manual", middleware.ManagerOrAdmin(), handlers.CreateOrUpdateManualAttendance)
		attendance.DELETE("/:id", middleware.ManagerOrAdmin(), handlers.DeleteAttendance)
	}

	// --- Advances ---
	advances := api.Group("/advances")
	advances.Use(middleware.AuthMiddleware())
	{
		advances.DELETE("/:id", middleware.AdminOnly(), handlers.DeleteAdvance)
	}

	// --- Loans ---
	loans := api.Group("/loans")
	loans.Use(middleware.AuthMiddleware())
	{
		loans.PUT("/:id", middleware.AdminOnly(), handlers.UpdateLoan)
		loans.DELETE("/:id", middleware.AdminOnly(), handlers.DeleteLoan)
	}

	// --- Company Profile ---
	company := api.Group("/company-profile")
	company.Use(middleware.AuthMiddleware())
	{
		company.GET("", middleware.ManagerOrAdmin(), handlers.GetCompanyProfile)
		company.PUT("", middleware.AdminOnly(), handlers.UpdateCompanyProfile)
	}

	// --- Payroll Settings ---
	settings := api.Group("/payroll-settings")
	settings.Use(middleware.AuthMiddleware())
	{
		settings.GET("", middleware.ManagerOrAdmin(), handlers.GetPayrollSettings)
		settings.PUT("/:key", middleware.AdminOnly(), handlers.UpdatePayrollSetting)
	}

	// --- Payroll ---
	payroll := api.Group("/payroll")
	payroll.Use(middleware.AuthMiddleware())
	{
		payroll.GET("/calculate", middleware.ManagerOrAdmin(), handlers.CalculatePayroll)
		payroll.POST("/save", middleware.AdminOnly(), handlers.SavePayroll)
		payroll.GET("/history", middleware.ManagerOrAdmin(), handlers.GetPayrollHistory)
		payroll.GET("/employee/:id", handlers.GetEmployeePayroll)
		payroll.POST("/email-payslip", middleware.ManagerOrAdmin(), handlers.EmailPayslip)
	}
}
