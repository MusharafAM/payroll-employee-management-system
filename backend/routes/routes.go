package routes

import (
	"encoding/json"
	"net/http"

	"github.com/musharaf/payroll-backend/handlers"
	"github.com/musharaf/payroll-backend/middleware"
)

func SetupRoutes() http.Handler {
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "OK"})
	})

	// --- Auth ---
	mux.Handle("POST /api/auth/sync-user", middleware.Auth(http.HandlerFunc(handlers.SyncUser)))
	mux.Handle("GET /api/auth/me", middleware.Auth(http.HandlerFunc(handlers.GetCurrentUser)))

	// --- Employees ---
	mux.Handle("GET /api/employees", middleware.Auth(middleware.ManagerOrAdmin(http.HandlerFunc(handlers.GetAllEmployees))))
	mux.Handle("GET /api/employees/{id}", middleware.Auth(http.HandlerFunc(handlers.GetEmployee)))
	mux.Handle("POST /api/employees", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(handlers.CreateEmployee))))
	mux.Handle("PUT /api/employees/{id}", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(handlers.UpdateEmployee))))
	mux.Handle("DELETE /api/employees/{id}", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(handlers.DeleteEmployee))))

	// --- Attendance ---
	mux.Handle("POST /api/attendance/upload", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(handlers.UploadAttendance))))
	mux.Handle("GET /api/attendance/employee/{id}", middleware.Auth(http.HandlerFunc(handlers.GetEmployeeAttendance)))

	// --- Payroll Settings ---
	mux.Handle("GET /api/payroll-settings", middleware.Auth(middleware.ManagerOrAdmin(http.HandlerFunc(handlers.GetPayrollSettings))))
	mux.Handle("PUT /api/payroll-settings/{key}", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(handlers.UpdatePayrollSetting))))

	return middleware.CORS(mux)
}
