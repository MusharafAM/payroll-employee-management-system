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
		employees.GET("/:id/advances", handlers.ListAdvances)
		employees.POST("/:id/advances", middleware.AdminOnly(), handlers.CreateAdvance)
		employees.GET("/:id/loans", handlers.ListLoans)
		employees.POST("/:id/loans", middleware.AdminOnly(), handlers.CreateLoan)
		employees.GET("/:id/leave-balance", handlers.GetLeaveBalance)
		employees.GET("/:id/leaves", handlers.ListLeaves)
		employees.POST("/:id/leaves", middleware.AdminOnly(), handlers.CreateLeave)
		employees.POST("/:id/leave-requests", handlers.RequestLeave)
		employees.PUT("/:id/leave-entitlement", middleware.AdminOnly(), handlers.UpdateLeaveEntitlement)
		employees.GET("/:id/disciplinary", middleware.ManagerOrAdmin(), handlers.ListDisciplinary)
		employees.POST("/:id/disciplinary", middleware.AdminOnly(), handlers.CreateDisciplinary)
		employees.GET("/:id/exit", middleware.AdminOnly(), handlers.GetEmployeeExit)
		employees.POST("/:id/exit", middleware.AdminOnly(), handlers.CreateExit)
		employees.GET("/:id/exit-settlement", middleware.AdminOnly(), handlers.GetExitSettlement)
		employees.GET("/:id/attendance-score", middleware.ManagerOrAdmin(), handlers.GetAttendanceScore)
		employees.GET("/:id/performance-reviews", handlers.ListEmployeeReviews)
		employees.POST("/:id/performance-reviews", middleware.AdminOnly(), handlers.CreatePerformanceReview)
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

	// --- Leave requests (pending review) ---
	leaveRequests := api.Group("/leave-requests")
	leaveRequests.Use(middleware.AuthMiddleware())
	{
		leaveRequests.GET("", middleware.ManagerOrAdmin(), handlers.GetPendingLeaveRequests)
	}

	// --- Leaves ---
	leavesGroup := api.Group("/leaves")
	leavesGroup.Use(middleware.AuthMiddleware())
	{
		leavesGroup.DELETE("/:id", handlers.DeleteLeave)
		leavesGroup.PUT("/:id/approve", middleware.ManagerOrAdmin(), handlers.ApproveLeave)
		leavesGroup.PUT("/:id/reject", middleware.ManagerOrAdmin(), handlers.RejectLeave)
	}

	// --- Company Profile ---
	company := api.Group("/company-profile")
	company.Use(middleware.AuthMiddleware())
	{
		company.GET("", middleware.ManagerOrAdmin(), handlers.GetCompanyProfile)
		company.PUT("", middleware.AdminOnly(), handlers.UpdateCompanyProfile)
	}

	// --- Public Holidays ---
	holidays := api.Group("/holidays")
	holidays.Use(middleware.AuthMiddleware())
	{
		holidays.GET("", middleware.ManagerOrAdmin(), handlers.ListHolidays)
		holidays.POST("", middleware.ManagerOrAdmin(), handlers.CreateHoliday)
		holidays.PUT("/:id", middleware.ManagerOrAdmin(), handlers.UpdateHoliday)
		holidays.DELETE("/:id", middleware.ManagerOrAdmin(), handlers.DeleteHoliday)
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
		payroll.GET("/months", middleware.ManagerOrAdmin(), handlers.GetSavedPayrollMonths)
		payroll.GET("/employee/:id", handlers.GetEmployeePayroll)
		payroll.GET("/employee/:id/history", handlers.GetEmployeePayrollHistory)
		payroll.POST("/email-payslip", middleware.ManagerOrAdmin(), handlers.EmailPayslip)
		payroll.POST("/notify-ready", middleware.AdminOnly(), handlers.NotifyPayslipReady)
	}

	// --- Disciplinary ---
	disciplinary := api.Group("/disciplinary")
	disciplinary.Use(middleware.AuthMiddleware())
	{
		disciplinary.PUT("/:id", middleware.AdminOnly(), handlers.UpdateDisciplinary)
		disciplinary.DELETE("/:id", middleware.AdminOnly(), handlers.DeleteDisciplinary)
	}

	// --- Performance Reviews ---
	performanceReviews := api.Group("/performance-reviews")
	performanceReviews.Use(middleware.AuthMiddleware())
	{
		performanceReviews.GET("", middleware.ManagerOrAdmin(), handlers.ListAllReviews)
		performanceReviews.PUT("/:id", middleware.AdminOnly(), handlers.UpdatePerformanceReview)
		performanceReviews.DELETE("/:id", middleware.AdminOnly(), handlers.DeletePerformanceReview)
	}

	// --- Exit Management ---
	exits := api.Group("/exits")
	exits.Use(middleware.AuthMiddleware())
	{
		exits.GET("", middleware.AdminOnly(), handlers.ListAllExits)
		exits.PUT("/:id", middleware.AdminOnly(), handlers.UpdateExit)
		exits.PUT("/:id/approve", middleware.AdminOnly(), handlers.ApproveExit)
		exits.PUT("/:id/complete", middleware.AdminOnly(), handlers.CompleteExit)
		exits.DELETE("/:id", middleware.AdminOnly(), handlers.DeleteExit)
	}
}
