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
	}
}
