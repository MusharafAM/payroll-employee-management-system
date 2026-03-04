package database

import (
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/musharaf/payroll-backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set in .env file")
	}

	// Parse the DSN and force simple query protocol.
	// Required for Supabase PgBouncer (transaction mode, port 6543)
	// which does not support prepared statements.
	connConfig, err := pgx.ParseConfig(dsn)
	if err != nil {
		log.Fatal("Failed to parse DATABASE_URL:", err)
	}
	connConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	sqlDB := stdlib.OpenDB(*connConfig)

	DB, err = gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("✅ Database connected successfully")
}

func Migrate() {
	err := DB.AutoMigrate(
		&models.User{},
		&models.SalaryProfile{},
		&models.PayrollSettings{},
		&models.Attendance{},
		&models.Payroll{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
	log.Println("✅ Database migrated successfully")

	seedPayrollSettings()
}

// seedPayrollSettings inserts default admin-configurable payroll rules.
// Uses FirstOrCreate so existing custom values are never overwritten.
func seedPayrollSettings() {
	defaults := []models.PayrollSettings{
		{Key: "overtime_multiplier", Value: 1.5, Description: "Overtime pay rate multiplier (e.g. 1.5 = time-and-a-half)"},
		{Key: "holiday_multiplier", Value: 2.0, Description: "Holiday pay rate multiplier"},
		{Key: "epf_employee_rate", Value: 8.0, Description: "Employee EPF contribution (%)"},
		{Key: "epf_employer_rate", Value: 12.0, Description: "Employer EPF contribution (%)"},
		{Key: "etf_rate", Value: 3.0, Description: "ETF contribution rate (%)"},
		{Key: "standard_work_hours", Value: 8.0, Description: "Standard daily work hours"},
	}

	for _, s := range defaults {
		DB.Where(models.PayrollSettings{Key: s.Key}).FirstOrCreate(&s)
	}
	log.Println("✅ Payroll settings seeded")
}
